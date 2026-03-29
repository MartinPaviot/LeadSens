import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ─── TTL presets (seconds) ────────────────────────────────

export const TTL = {
  RANKING:    60 * 60 * 24,      // 24h  — DataForSEO rankings
  SERP:       60 * 60 * 6,       // 6h   — SerpAPI SERP results
  KEYWORDS:   60 * 60 * 24 * 7,  // 7d   — keyword volumes (slow-changing)
  CRAWL:      60 * 60 * 12,      // 12h  — site crawl results
  COMPETITOR: 60 * 60 * 24,      // 24h  — competitor benchmark
  PAGESPEED:  60 * 60 * 4,       // 4h   — Core Web Vitals
  GBP:        60 * 60 * 24,      // 24h  — Google Business Profile
  SESSION:    60 * 60 * 2,       // 2h   — session-scoped benchmark
} as const;

// ─── Key builders ─────────────────────────────────────────

export const cacheKey = {
  ranking:    (domain: string, keyword: string, geo: string) =>
    `ranking:${domain}:${keyword}:${geo}`,
  serp:       (keyword: string, geo: string) =>
    `serp:${keyword}:${geo}`,
  keywords:   (seed: string, geo: string) =>
    `kw:${seed}:${geo}`,
  crawl:      (siteUrl: string) =>
    `crawl:${siteUrl}`,
  competitor: (domain: string, keyword: string) =>
    `comp:${domain}:${keyword}`,
  pagespeed:  (url: string) =>
    `pagespeed:${url}`,
  gbp:        (profileId: string) =>
    `gbp:${profileId}`,
  session:    (sessionId: string, key: string) =>
    `session:${sessionId}:${key}`,
} as const;

// ─── Core operations ──────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get<T>(key);
    return value ?? null;
  } catch {
    // Cache miss is non-blocking — never throw, always degrade gracefully
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    // Cache write failure is non-blocking — log but never throw
    console.warn(`[cache] Failed to write key: ${key}`);
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch {
    console.warn(`[cache] Failed to delete key: ${key}`);
  }
}

export async function cacheGetOrFetch<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const fresh = await fetcher();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}

// ─── Batch invalidation ───────────────────────────────────

export async function invalidatePattern(prefix: string): Promise<void> {
  try {
    // Upstash scan — safe for serverless
    let cursor = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: `${prefix}*`,
        count: 100,
      });
      cursor = Number(nextCursor);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== 0);
  } catch {
    console.warn(`[cache] Failed to invalidate pattern: ${prefix}`);
  }
}

export { redis };
