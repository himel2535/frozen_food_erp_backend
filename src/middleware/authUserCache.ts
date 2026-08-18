/** In-process TTL cache for auth User.findById — JWT is still verified on every request. */

const AUTH_USER_CACHE_TTL_MS = 3_000;

export type CachedAuthUser = {
  _id: unknown;
  status?: string;
  role?: string;
  tenantId?: string;
  email?: string;
  name?: string;
};

type CacheEntry = {
  user: CachedAuthUser;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

export function invalidateAuthUserCache(userId?: string) {
  if (!userId) {
    cache.clear();
    return;
  }
  cache.delete(userId);
}

export function getCachedAuthUser(userId: string): CachedAuthUser | null {
  const hit = cache.get(userId);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(userId);
    return null;
  }
  return hit.user;
}

export function setCachedAuthUser(userId: string, user: CachedAuthUser) {
  cache.set(userId, {
    user,
    expiresAt: Date.now() + AUTH_USER_CACHE_TTL_MS,
  });
}
