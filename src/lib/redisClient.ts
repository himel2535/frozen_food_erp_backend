import type { RedisClientType } from 'redis';
import { env } from '../config/env.js';

let client: RedisClientType | null = null;
let ready = false;

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
    return await client.get(key);
  } catch {
    return null;
  }
}

export async function redisSet(key: string, value: string, ttlMs: number): Promise<void> {
  if (!isRedisReady() || !client) return;
  try {
    await client.set(key, value, { PX: ttlMs });
  } catch {
    /* in-memory fallback handles misses */
  }
}

export async function redisDelByPrefix(prefix: string): Promise<void> {
  if (!isRedisReady() || !client) return;
  try {
    const keys: string[] = [];
    for await (const key of client.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
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
