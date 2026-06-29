/**
 * In-memory cache with TTL support.
 *
 * Cache key conventions:
 *   players:list:<hash>   – paginated player search results (keyed by filter params)
 *   players:<playerId>    – single player profile
 *   milestones:<playerId> – milestone list for a player
 *
 * TODO (Redis): Replace Map with a Redis client for distributed deployments.
 */

import config from '../config';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

export function cacheSet<T>(key: string, value: T, ttlMs = config.playerCacheTtlMs): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidatePlayerCache(playerId?: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith('players:list:')) {
      cache.delete(key);
    }
  }
  if (playerId) {
    cache.delete(`players:${playerId}`);
  }
}

export function invalidateMilestoneCache(playerId: string): void {
  cache.delete(`milestones:${playerId}`);
  invalidatePlayerCache(playerId);
}
