import type { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/apiResponse.js';
import { isRedisReady, redisDelByPattern, redisGet, redisSet } from '../lib/redisClient.js';

type CacheEntry = {
  body: unknown;
  meta?: Record<string, unknown>;
  expiresAt: number;
};

type CacheKeyFn = (req: Request) => string;

const store = new Map<string, CacheEntry>();
const REDIS_KEY_PREFIX = 'erp:cache:';

/** In-flight MISS coalescing — concurrent identical GETs share one backend query. */
const inflightMisses = new Map<string, Promise<CacheEntry>>();

function readMemory(key: string): CacheEntry | null {
  const hit = store.get(key);
  if (!hit || hit.expiresAt <= Date.now()) {
    if (hit) store.delete(key);
    return null;
  }
  return hit;
}

function writeMemory(key: string, entry: CacheEntry) {
  store.set(key, entry);
}

function redisPhysicalKey(logicalKey: string): string {
  return `${REDIS_KEY_PREFIX}${logicalKey}`;
}

function settleInflight(key: string) {
  inflightMisses.delete(key);
}

/** Tenant-safe logical cache key. */
export function buildTenantCacheKey(req: Request): string {
  const tenantId = String(req.query.tenantId ?? 'default');
  const path = req.path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  if (!params.has('tenantId')) params.set('tenantId', tenantId);
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const qs = sorted.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return `tenant:${tenantId}:${path}${qs ? `?${qs}` : ''}`;
}

export function dashboardSummaryCacheKey(req: Request): string {
  const tenantId = String(req.query.tenantId ?? 'default');
  const scope = String(req.query.scope ?? 'full').toLowerCase();
  return `tenant:${tenantId}:/api/v1/dashboard/summary?scope=${encodeURIComponent(scope)}&tenantId=${encodeURIComponent(tenantId)}`;
}

export function dashboardTopProductsCacheKey(req: Request): string {
  const tenantId = String(req.query.tenantId ?? 'default');
  const limit = String(req.query.limit ?? '5');
  return `tenant:${tenantId}:/api/v1/dashboard/top-products?limit=${encodeURIComponent(limit)}&tenantId=${encodeURIComponent(tenantId)}`;
}

export function dashboardBusinessAlertsCacheKey(req: Request): string {
  const tenantId = String(req.query.tenantId ?? 'default');
  return `tenant:${tenantId}:/api/v1/dashboard/business-alerts?tenantId=${encodeURIComponent(tenantId)}`;
}

function attachCacheWriter(
  res: Response,
  key: string,
  ttlMs: number,
  inflightPromise?: Promise<CacheEntry>,
) {
  const originalJson = res.json.bind(res);
  res.json = ((payload: { success?: boolean; data?: unknown; meta?: Record<string, unknown> }) => {
    if (payload?.success !== false && payload?.data !== undefined) {
      const entry: CacheEntry = {
        body: payload.data,
        meta: payload.meta,
        expiresAt: Date.now() + ttlMs,
      };
      writeMemory(key, entry);
      if (isRedisReady()) {
        void redisSet(redisPhysicalKey(key), JSON.stringify(entry), ttlMs);
      }
      if (inflightPromise) settleInflight(key);
    }
    return originalJson(payload);
  }) as typeof res.json;

  if (inflightPromise) {
    res.on('close', () => {
      if (inflightMisses.get(key) === inflightPromise) {
        inflightMisses.delete(key);
      }
    });
  }
}

function createInflightWaiter(key: string): Promise<CacheEntry> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      const hit = readMemory(key);
      if (hit) {
        resolve(hit);
        return;
      }
      if (Date.now() - start > 30_000) {
        reject(new Error('cache inflight timeout'));
        return;
      }
      setTimeout(poll, 10);
    };
    poll();
  });
}

/** GET cache — Redis when REDIS_URL is set, otherwise in-memory. */
export function cacheGetResponse(ttlMs: number, keyFn: CacheKeyFn = buildTenantCacheKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const key = keyFn(req);
    const memoryHit = readMemory(key);
    if (memoryHit) {
      console.log(`[cache] HIT memory ${req.method} ${key}`);
      return sendSuccess(res, memoryHit.body, memoryHit.meta);
    }

    if (isRedisReady()) {
      try {
        const raw = await redisGet(redisPhysicalKey(key));
        if (res.headersSent) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as CacheEntry;
            if (parsed.expiresAt > Date.now()) {
              writeMemory(key, parsed);
              console.log(`[cache] HIT redis ${req.method} ${key}`);
              return sendSuccess(res, parsed.body, parsed.meta);
            }
          } catch {
            /* fall through to miss */
          }
        }
      } catch {
        /* fall through to miss */
      }
    }

    const existingInflight = inflightMisses.get(key);
    if (existingInflight) {
      try {
        const entry = await existingInflight;
        if (!res.headersSent && entry.expiresAt > Date.now()) {
          console.log(`[cache] HIT inflight ${req.method} ${key}`);
          return sendSuccess(res, entry.body, entry.meta);
        }
      } catch {
        /* fall through to new miss */
      }
    }

    if (res.headersSent) return;

    const inflightPromise = createInflightWaiter(key);
    inflightMisses.set(key, inflightPromise);

    console.log(`[cache] MISS ${req.method} ${key}`);
    attachCacheWriter(res, key, ttlMs, inflightPromise);
    next();
  };
}

export function clearResponseCache(prefix?: string) {
  if (!prefix) {
    store.clear();
    inflightMisses.clear();
    void redisDelByPattern(`${REDIS_KEY_PREFIX}*`);
    return;
  }
  for (const key of store.keys()) {
    if (key.includes(prefix)) store.delete(key);
  }
  for (const key of inflightMisses.keys()) {
    if (key.includes(prefix)) inflightMisses.delete(key);
  }
  void redisDelByPattern(`${REDIS_KEY_PREFIX}*${prefix}*`);
}
