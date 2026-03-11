import Redis from "ioredis";

let redis: Redis | null = null;

/**
 * Returns a shared Redis client. Lazy-initialized on first call.
 * Safe for serverless — the connection is reused across warm invocations.
 */
export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: false,
    });
  }
  return redis;
}
