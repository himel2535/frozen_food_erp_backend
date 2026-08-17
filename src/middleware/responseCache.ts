import type { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/apiResponse.js';
import { isRedisReady, redisDelByPrefix, redisGet, redisSet } from '../lib/redisClient.js';

type CacheEntry = {
  body: unknown;
  meta?: Record<string, unknown>;
  expiresAt: number;
};

type CacheKeyFn = (req: Request) => string;

const store = new Map<string, CacheEntry>();
const REDIS_KEY_PREFIX = 'erp:cache:';

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

function attachCacheWriter(res: Response, key: string, ttlMs: number) {
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
        void redisSet(`${REDIS_KEY_PREFIX}${key}`, JSON.stringify(entry), ttlMs);
      }
    }
    return originalJson(payload);
  }) as typeof res.json;
}

export function dashboardSummaryCacheKey(req: Request): string {
  const tenantId = String(req.query.tenantId ?? 'default');
  const scope = String(req.query.scope ?? 'full').toLowerCase();
  return `/api/v1/dashboard/summary?tenantId=${encodeURIComponent(tenantId)}&scope=${encodeURIComponent(scope)}`;
}

/** GET cache — Redis when REDIS_URL is set, otherwise in-memory. */
export function cacheGetResponse(ttlMs: number, keyFn: CacheKeyFn = (req) => req.originalUrl) {
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
        const raw = await redisGet(`${REDIS_KEY_PREFIX}${key}`);
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

    if (res.headersSent) return;
    console.log(`[cache] MISS ${req.method} ${key}`);
    attachCacheWriter(res, key, ttlMs);
    next();
  };
}

export function clearResponseCache(prefix?: string) {
  if (!prefix) {
    store.clear();
    void redisDelByPrefix(REDIS_KEY_PREFIX);
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
  void redisDelByPrefix(`${REDIS_KEY_PREFIX}${prefix}`);
}
