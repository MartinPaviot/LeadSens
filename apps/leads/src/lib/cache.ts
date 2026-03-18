/**
 * Redis-backed caching utility.
 *
 * Used to cache expensive DB queries (correlator, providers, style samples)
 * that only change on sync/webhook events.
 *
 * Gracefully degrades when Redis is unavailable — returns null on get,
 * silently skips set/invalidate. All callers handle cache misses already.
 */

import { getRedis, RedisUnavailableError } from "./redis";

const PREFIX = "cache:";

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const r = getRedis();
    const data = await r.get(`${PREFIX}${key}`);
    return data ? (JSON.parse(data) as T) : null;
  } catch (e) {
    if (e instanceof RedisUnavailableError) return null;
    throw e;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    const r = getRedis();
    await r.set(`${PREFIX}${key}`, JSON.stringify(value), "EX", ttlSeconds);
  } catch (e) {
    if (e instanceof RedisUnavailableError) return;
    throw e;
  }
}

/**
 * Invalidate all cached keys matching a pattern.
 * Uses SCAN instead of KEYS for production safety on large key spaces.
 */
export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  try {
    const r = getRedis();
    const fullPattern = `${PREFIX}${pattern}`;
    let cursor = "0";
    do {
      const [nextCursor, keys] = await r.scan(cursor, "MATCH", fullPattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await r.del(...keys);
      }
    } while (cursor !== "0");
  } catch (e) {
    if (e instanceof RedisUnavailableError) return;
    throw e;
  }
}
