/**
 * Redis-backed caching utility.
 *
 * Used to cache expensive DB queries (correlator, providers, style samples)
 * that only change on sync/webhook events.
 */

import { getRedis } from "./redis";

const PREFIX = "cache:";

export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  const data = await r.get(`${PREFIX}${key}`);
  return data ? (JSON.parse(data) as T) : null;
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const r = getRedis();
  await r.set(`${PREFIX}${key}`, JSON.stringify(value), "EX", ttlSeconds);
}

/**
 * Invalidate all cached keys matching a pattern.
 * Uses SCAN instead of KEYS for production safety on large key spaces.
 */
export async function cacheInvalidatePattern(pattern: string): Promise<void> {
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
}
