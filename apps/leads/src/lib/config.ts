import { z } from "zod/v4";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.url("DATABASE_URL must be a valid URL"),
  DIRECT_URL: z.url("DIRECT_URL must be a valid URL").optional(),

  // Redis
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  // LLM — Mistral only in V1
  MISTRAL_API_KEY: z.string().min(1, "MISTRAL_API_KEY is required"),

  // Encryption
  ENCRYPTION_KEY: z
    .string()
    .length(64, "ENCRYPTION_KEY must be exactly 64 hex characters")
    .regex(/^[0-9a-fA-F]+$/, "ENCRYPTION_KEY must be hexadecimal"),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z.url().optional().default("http://localhost:3000"),

  // OAuth (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Integrations (optional — connected per workspace)
  HUBSPOT_CLIENT_ID: z.string().optional(),
  HUBSPOT_CLIENT_SECRET: z.string().optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.url().optional().default("http://localhost:3000"),

  // Rate limits
  JINA_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(18),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = z.prettifyError(result.error);
    console.error("[LeadSens] Invalid environment variables:\n", formatted);
    throw new Error("[LeadSens] Missing or invalid environment variables. Check logs above.");
  }

  return result.data;
}

export const env = validateEnv();
