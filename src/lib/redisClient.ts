import type { RedisClientType } from 'redis';
import { env } from '../config/env.js';

let client: RedisClientType | null = null;
let ready = false;

export const KEY_PREFIX = 'frozen_food:';

/** Prepend keyPrefix 'frozen_food:' if not already present. */
export function addKeyPrefix(key: string): string {
  if (key.startsWith(KEY_PREFIX)) {
    return key;
  }
  return `${KEY_PREFIX}${key}`;
}

export function isRedisReady() {
  return ready && client !== null;
}

export async function initRedis(): Promise<void> {
  if (!env.redisUrl) return;
  try {
    const { createClient } = await import('redis');
    client = createClient({ url: env.redisUrl });
    client.on('error', (err) => {
      console.warn('[redis] Client error — falling back to in-memory cache:', err.message);
      ready = false;
    });
    await client.connect();
    ready = true;
    console.log('[redis] Connected');
  } catch (err) {
    ready = false;
    client = null;
    console.warn('[redis] Unavailable — using in-memory cache only:', err instanceof Error ? err.message : err);
  }
}

export async function redisGet(key: string): Promise<string | null> {
  if (!isRedisReady() || !client) return null;
  try {
    return await client.get(addKeyPrefix(key));
  } catch {
    return null;
  }
}

export async function redisSet(key: string, value: string, ttlMs: number): Promise<void> {
  if (!isRedisReady() || !client) return;
  try {
    await client.set(addKeyPrefix(key), value, { PX: ttlMs });
  } catch {
    /* in-memory fallback handles misses */
  }
}

export async function redisDelByPrefix(prefix: string): Promise<void> {
  if (!isRedisReady() || !client) return;
  try {
    const pattern = addKeyPrefix(`${prefix}*`);
    const keys: string[] = [];
    for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(String(key));
      if (keys.length >= 200) {
        await client.del(keys);
        keys.length = 0;
      }
    }
    if (keys.length) await client.del(keys);
  } catch {
    /* ignore */
  }
}

/** Delete Redis keys matching a glob pattern (e.g. erp:cache:*products*). */
export async function redisDelByPattern(pattern: string): Promise<void> {
  if (!isRedisReady() || !client) return;
  try {
    const matchPattern = addKeyPrefix(pattern);
    const keys: string[] = [];
    for await (const key of client.scanIterator({ MATCH: matchPattern, COUNT: 100 })) {
      keys.push(String(key));
      if (keys.length >= 200) {
        await client.del(keys);
        keys.length = 0;
      }
    }
    if (keys.length) await client.del(keys);
  } catch {
    /* ignore */
  }
}

export async function redisDel(key: string): Promise<boolean> {
  if (!isRedisReady() || !client) return false;
  try {
    await client.del(addKeyPrefix(key));
    return true;
  } catch {
    return false;
  }
}

export async function redisTtl(key: string): Promise<number | null> {
  if (!isRedisReady() || !client) return null;
  try {
    return await client.pTTL(addKeyPrefix(key));
  } catch {
    return null;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    await client.disconnect().catch(() => undefined);
  } finally {
    client = null;
    ready = false;
  }
}
