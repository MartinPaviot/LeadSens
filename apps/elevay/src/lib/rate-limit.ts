import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// ── Redis client (graceful if env vars missing) ─────────

let redis: Redis | null = null
try {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) {
    redis = new Redis({ url, token })
  }
} catch {
  // Redis unavailable — fall through to in-memory fallback
}

// ── Upstash limiters ────────────────────────────────────

const agentLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "60 s"),
      prefix: "elevay:rl:agent",
    })
  : null

const llmPerMinuteLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "60 s"),
      prefix: "elevay:rl:llm-min",
    })
  : null

const llmDailyLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(200, "86400 s"),
      prefix: "elevay:rl:llm-day",
    })
  : null

// ── In-memory fallback (when Redis is unavailable) ──────

const memoryStore = new Map<string, { count: number; resetAt: number }>()
const MEMORY_WINDOW_MS = 60_000 // 1 minute
const MEMORY_MAX_REQUESTS = 20

function checkMemoryLimit(key: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = memoryStore.get(key)

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + MEMORY_WINDOW_MS })
    return { allowed: true }
  }

  if (entry.count >= MEMORY_MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }

  entry.count++
  return { allowed: true }
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of memoryStore) {
    if (now > entry.resetAt) memoryStore.delete(key)
  }
}, 5 * 60_000).unref()

// ── Public API ──────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean
  retryAfter?: number
}

/**
 * Per-user rate limiter for general agent endpoints.
 * 10 requests per 60 seconds per user:agent combo.
 */
export async function checkRateLimit(
  userId: string,
  agentId: string,
): Promise<RateLimitResult> {
  const key = `${userId}:${agentId}`

  if (!agentLimiter) return checkMemoryLimit(key)

  try {
    const result = await agentLimiter.limit(key)
    if (!result.success) {
      return { allowed: false, retryAfter: Math.ceil((result.reset - Date.now()) / 1000) }
    }
    return { allowed: true }
  } catch {
    return checkMemoryLimit(key)
  }
}

/**
 * Rate limiter for LLM/Anthropic API calls.
 * Two tiers: 20 req/min per user + 200 req/day per workspace.
 * Prevents cost explosion from a single user or workspace.
 */
export async function checkLLMRateLimit(
  userId: string,
  workspaceId: string,
): Promise<RateLimitResult> {
  const userKey = `llm:${userId}`
  const wsKey = `llm:ws:${workspaceId}`

  if (!llmPerMinuteLimiter || !llmDailyLimiter) {
    // In-memory fallback
    const userCheck = checkMemoryLimit(userKey)
    if (!userCheck.allowed) return userCheck
    return checkMemoryLimit(wsKey)
  }

  try {
    // Check per-minute limit
    const minuteResult = await llmPerMinuteLimiter.limit(userKey)
    if (!minuteResult.success) {
      return {
        allowed: false,
        retryAfter: Math.ceil((minuteResult.reset - Date.now()) / 1000),
      }
    }

    // Check daily limit
    const dailyResult = await llmDailyLimiter.limit(wsKey)
    if (!dailyResult.success) {
      return {
        allowed: false,
        retryAfter: Math.ceil((dailyResult.reset - Date.now()) / 1000),
      }
    }

    return { allowed: true }
  } catch {
    // Redis failure — fallback to in-memory
    const userCheck = checkMemoryLimit(userKey)
    if (!userCheck.allowed) return userCheck
    return checkMemoryLimit(wsKey)
  }
}

/**
 * Build a 429 Response for rate-limited requests.
 */
export function rateLimitResponse(retryAfter = 60): Response {
  return Response.json(
    { error: "RATE_LIMIT_EXCEEDED", retryAfter },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    },
  )
}
