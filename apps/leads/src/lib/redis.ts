import Redis from "ioredis";

let redis: Redis | null = null;
let redisUnavailable = false;

/**
 * Returns a shared Redis client. Lazy-initialized on first call.
 * Safe for serverless — the connection is reused across warm invocations.
 * Returns null if REDIS_URL is not configured (graceful degradation).
 */
export function getRedis(): Redis {
  if (redisUnavailable) throw new RedisUnavailableError();
  if (!redis) {
    if (!process.env.REDIS_URL) {
      redisUnavailable = true;
      throw new RedisUnavailableError();
    }
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: false,
    });
    redis.on("error", () => {
      // Suppress connection errors — cache is best-effort
    });
  }
  return redis;
}

export class RedisUnavailableError extends Error {
  constructor() { super("Redis unavailable"); this.name = "RedisUnavailableError"; }
}

// ─── Job Progress Tracking ─────────────────────────────────

export interface JobProgress {
  current: number;
  total: number;
  stage: string;
  status: "running" | "done" | "error";
  error?: string;
  completedAt?: string;
}

export async function setJobProgress(jobId: string, progress: JobProgress): Promise<void> {
  const r = getRedis();
  await r.set(`job:${jobId}`, JSON.stringify(progress), "EX", 3600);
}

export async function getJobProgress(jobId: string): Promise<JobProgress | null> {
  const r = getRedis();
  const data = await r.get(`job:${jobId}`);
  return data ? JSON.parse(data) as JobProgress : null;
}

// ─── Idempotency ────────────────────────────────────────────

/**
 * Redis-based idempotency check. Returns true on the FIRST call for a given key,
 * false on subsequent calls within the TTL window.
 * Uses SET NX (set-if-not-exists) for atomic check-and-set.
 */
export async function checkIdempotency(key: string, ttlSeconds = 3600): Promise<boolean> {
  const r = getRedis();
  const result = await r.set(`idem:${key}`, "1", "EX", ttlSeconds, "NX");
  return result === "OK";
}
