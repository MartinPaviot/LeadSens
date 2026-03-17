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
