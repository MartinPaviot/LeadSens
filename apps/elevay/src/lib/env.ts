import { z } from "zod"

// ── Full environment schema ─────────────────────────────

const envSchema = z.object({
  // Core
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3001"),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3001"),

  // Database
  DATABASE_URL: z.string().min(1),

  // LLM
  ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-"),

  // Encryption (required in production)
  ENCRYPTION_KEY: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]+$/i, "Must be 64 hex characters")
    .optional(),

  // Sentry (optional)
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // Upstash Redis (optional in dev)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Google OAuth (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Data APIs (optional — graceful degradation)
  SERPAPI_KEY: z.string().min(1).optional(),
  GNEWS_API_KEY: z.string().min(1).optional(),
  DATAFORSEO_LOGIN: z.string().min(1).optional(),
  DATAFORSEO_PASSWORD: z.string().min(1).optional(),
  YOUTUBE_API_KEY: z.string().min(1).optional(),
  FIRECRAWL_API_KEY: z.string().min(1).optional(),

  // Composio
  COMPOSIO_API_KEY: z.string().min(1).optional(),

  // Apify
  APIFY_TOKEN: z.string().min(1).optional(),
  APIFY_TASK_FACEBOOK: z.string().min(1).optional(),
  APIFY_TASK_INSTAGRAM: z.string().min(1).optional(),

  // Webhook security
  SMI_WEBHOOK_SECRET: z.string().min(32).optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),
})

type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n")

    if (process.env.NODE_ENV === "production") {
      throw new Error(`Invalid environment variables:\n${issues}`)
    }
    // In dev, warn but don't crash (allows partial configs)
  }
  // Return parsed data or raw env as fallback in dev
  return (result.data ?? process.env) as Env
}

/** Validated environment variables */
export const env = validateEnv()

/**
 * Safe environment variable access.
 * Fails fast with a clear error message.
 */
export function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required env var: ${key}`)
  return val
}
