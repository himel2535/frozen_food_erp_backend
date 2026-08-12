import type { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/apiResponse.js';
import { isRedisReady, redisDelByPrefix, redisGet, redisSet } from '../lib/redisClient.js';

type CacheEntry = {
  body: unknown;
  meta?: Record<string, unknown>;
  expiresAt: number;
};

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

/** GET cache — Redis when REDIS_URL is set, otherwise in-memory. */
export function cacheGetResponse(ttlMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const key = req.originalUrl;
    const memoryHit = readMemory(key);
    if (memoryHit) {
      return sendSuccess(res, memoryHit.body, memoryHit.meta);
    }

    attachCacheWriter(res, key, ttlMs);

    if (!isRedisReady()) return next();

    void redisGet(`${REDIS_KEY_PREFIX}${key}`).then((raw) => {
      if (res.headersSent) return;
      if (!raw) {
        next();
        return;
      }
      try {
        const parsed = JSON.parse(raw) as CacheEntry;
        if (parsed.expiresAt <= Date.now()) {
          next();
          return;
        }
        writeMemory(key, parsed);
        sendSuccess(res, parsed.body, parsed.meta);
      } catch {
        next();
      }
    }).catch(() => next());
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
