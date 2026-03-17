import { getRedis } from "./redis";

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Sliding window rate limiter backed by Redis.
 * Uses INCR + EXPIRE for simplicity. Each key = identifier + window.
 *
 * @param identifier - Unique key (e.g. IP address or userId)
 * @param limit - Max requests per window
 * @param windowSeconds - Window duration in seconds
 */
export async function rateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redis = getRedis();
  const windowKey = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `rl:${identifier}:${windowKey}`;

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    const ttl = await redis.ttl(key);

    return {
      success: current <= limit,
      remaining: Math.max(0, limit - current),
      resetInSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  } catch {
    // If Redis is down, allow the request (fail-open)
    return { success: true, remaining: limit, resetInSeconds: windowSeconds };
  }
}

/**
 * Convenience: rate limit by IP address.
 * Default: 30 requests per 60 seconds for the chat endpoint.
 */
export async function rateLimitByIp(
  ip: string,
  limit = 30,
  windowSeconds = 60,
): Promise<RateLimitResult> {
  return rateLimit(`ip:${ip}`, limit, windowSeconds);
}
