import type { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/apiResponse.js';

type CacheEntry = {
  body: unknown;
  meta?: Record<string, unknown>;
  expiresAt: number;
};

const store = new Map<string, CacheEntry>();

/** In-memory GET cache for slow-changing dropdown/list data (categories, units, warehouses). */
export function cacheGetResponse(ttlMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const key = req.originalUrl;
    const hit = store.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return sendSuccess(res, hit.body, hit.meta);
    }

    const originalJson = res.json.bind(res);
    res.json = ((payload: { success?: boolean; data?: unknown; meta?: Record<string, unknown> }) => {
      if (payload?.success !== false && payload?.data !== undefined) {
        store.set(key, {
          body: payload.data,
          meta: payload.meta,
          expiresAt: Date.now() + ttlMs,
        });
      }
      return originalJson(payload);
    }) as typeof res.json;

    next();
  };
}

export function clearResponseCache(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
