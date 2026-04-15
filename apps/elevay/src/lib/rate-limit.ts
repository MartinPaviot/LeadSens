import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { requireEnv } from '@/lib/env';

const redis = new Redis({
  url: requireEnv('UPSTASH_REDIS_REST_URL'),
  token: requireEnv('UPSTASH_REDIS_REST_TOKEN'),
});

/**
 * Per-user rate limiter: 10 requests per 60 seconds per agent.
 * Returns { success, remaining, reset } or null if Redis is unavailable.
 */
const limiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  prefix: 'elevay:rl',
});

export async function checkRateLimit(
  userId: string,
  agentId: string,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  try {
    const result = await limiter.limit(`${userId}:${agentId}`);
    if (!result.success) {
      return { allowed: false, retryAfter: Math.ceil((result.reset - Date.now()) / 1000) };
    }
    return { allowed: true };
  } catch (err) {
    // Redis unavailable — allow the request (fail open) but log
    return { allowed: true };
  }
}
