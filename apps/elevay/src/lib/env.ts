import { z } from "zod"

// ── Brand-intel agent env vars (Zod validated) ─────────────────────
const brandIntelEnvSchema = z.object({
  // Core
  DATABASE_URL: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),

  // Data APIs (brand-intel agents)
  SERPAPI_KEY: z.string().min(1).optional(),
  GNEWS_API_KEY: z.string().min(1).optional(),
  DATAFORSEO_LOGIN: z.string().min(1).optional(),
  DATAFORSEO_PASSWORD: z.string().min(1).optional(),
  YOUTUBE_API_KEY: z.string().min(1).optional(),
  FIRECRAWL_API_KEY: z.string().min(1).optional(),

  // Composio — social OAuth (Facebook/Instagram)
  COMPOSIO_API_KEY: z.string().min(1).optional(),

  // Apify — fallback social scraping
  APIFY_TOKEN: z.string().min(1).optional(),
  APIFY_TASK_FACEBOOK: z.string().min(1).optional(),
  APIFY_TASK_INSTAGRAM: z.string().min(1).optional(),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3001"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
})

/** Validated env vars for brand-intel agents */
export const env = brandIntelEnvSchema.parse(process.env)

// ── Legacy helper (used by chat route + rate-limit) ────────────────
/**
 * Safe environment variable access.
 * Fails fast at module load time with a clear error message.
 */
export function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required env var: ${key}`)
  return val
}
