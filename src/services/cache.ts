/**
 * Search cache invalidation stubs.
 *
 * TODO (Redis): Replace the in-memory Set with a Redis client.
 *   import { createClient } from 'redis';
 *   const redis = createClient({ url: process.env.REDIS_URL });
 *   await redis.del(key);
 *
 * Cache key conventions:
 *   players:list          – all paginated player search results
 *   players:<playerId>    – single player profile
 *   milestones:<playerId> – milestone list for a player
 */

const cache = new Map<string, unknown>();

export function invalidatePlayerCache(playerId?: string): void {
  // TODO (Redis): await redis.del('players:list')
  cache.delete('players:list');
  if (playerId) {
    // TODO (Redis): await redis.del(`players:${playerId}`)
    cache.delete(`players:${playerId}`);
  }
}

export function invalidateMilestoneCache(playerId: string): void {
  // TODO (Redis): await redis.del(`milestones:${playerId}`)
  cache.delete(`milestones:${playerId}`);
  // Also bust the player list so updated progress tier is reflected
  invalidatePlayerCache(playerId);
}
