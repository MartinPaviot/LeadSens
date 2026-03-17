/**
 * DeBounce Connector — Email verification API.
 *
 * Endpoints used:
 * - GET /v1/?api=X&email=Y — Single email verification (also connection test)
 * - GET /v1/balance/?api=X — Get remaining credits
 *
 * Auth: Query param `api=API_KEY`
 * API docs: https://debounce.io/api-documentation/
 */

import { z } from "zod/v4";
import type { VerificationResult, VerificationStatus, VerifyBatchResult, EmailVerifier } from "../providers/email-verifier";
import { sleep, BATCH_VERIFY_DELAY_MS } from "./fetch-retry";

const DB_BASE = "https://api.debounce.io/v1";
const MAX_RETRIES = 3;

// ─── API Response Schemas ───────────────────────────────

const dbSingleSchema = z.object({
  debounce: z.object({
    email: z.string(),
    code: z.string(), // "5"=safe, "7"=invalid, "6"=disposable, "3"=accept_all, "4"=role, "8"=unknown
    result: z.string().optional(), // "Safe to Send", "Invalid", etc.
    reason: z.string().optional(),
    send_transactional: z.string().optional(), // "1" or "0"
    free_email: z.string().optional(), // "true" or "false"
    did_you_mean: z.string().optional(),
  }),
  success: z.string(), // "1" or "0"
});

const dbBalanceSchema = z.object({
  balance: z.union([z.string(), z.number()]),
  success: z.string().optional(),
});

// ─── Status Mapping ─────────────────────────────────────

function mapStatus(code: string): VerificationStatus {
  switch (code) {
    case "5": // Safe to Send
      return "valid";
    case "7": // Invalid
      return "invalid";
    case "6": // Disposable
      return "disposable";
    case "3": // Accept All / Catch-all
      return "catch_all";
    case "4": // Role Account
    case "8": // Unknown
    default:
      return "unknown";
  }
}

// ─── Public API ─────────────────────────────────────────

/**
 * Test DeBounce API key by validating a test email.
 */
export async function testDeBounceConnection(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${DB_BASE}/?api=${encodeURIComponent(apiKey)}&email=test@example.com`,
    );
    if (!res.ok) return false;
    const json = await res.json();
    const parsed = dbSingleSchema.safeParse(json);
    return parsed.success && parsed.data.success === "1";
  } catch {
    return false;
  }
}

/**
 * Get remaining DeBounce credits.
 */
export async function getDeBounceCredits(apiKey: string): Promise<number> {
  const res = await fetch(`${DB_BASE}/balance/?api=${encodeURIComponent(apiKey)}`);
  if (!res.ok) throw new Error(`DeBounce balance returned ${res.status}`);
  const json = await res.json();
  const parsed = dbBalanceSchema.parse(json);
  return typeof parsed.balance === "number" ? parsed.balance : parseInt(parsed.balance, 10);
}

/**
 * Validate a single email address.
 */
export async function validateEmail(
  apiKey: string,
  email: string,
): Promise<VerificationResult> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(
      `${DB_BASE}/?api=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}`,
    );

    if (res.ok) {
      const json = await res.json();
      const parsed = dbSingleSchema.parse(json);
      return {
        email: parsed.debounce.email,
        status: mapStatus(parsed.debounce.code),
        subStatus: parsed.debounce.reason ?? undefined,
        freeEmail: parsed.debounce.free_email === "true",
        didYouMean: parsed.debounce.did_you_mean || undefined,
      };
    }

    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      await sleep(Math.pow(2, attempt) * 1000);
      continue;
    }

    throw new Error(`DeBounce validate returned ${res.status}`);
  }

  throw new Error("DeBounce validate failed after retries");
}

/**
 * Validate a batch of emails (loops single checks).
 */
export async function validateEmailBatch(
  apiKey: string,
  emails: string[],
): Promise<VerifyBatchResult> {
  const results: VerificationResult[] = [];

  for (let i = 0; i < emails.length; i++) {
    if (i > 0) await sleep(BATCH_VERIFY_DELAY_MS);
    results.push(await validateEmail(apiKey, emails[i]));
  }

  return {
    results,
    validCount: results.filter((r) => r.status === "valid").length,
    invalidCount: results.filter((r) => r.status === "invalid").length,
    unknownCount: results.filter((r) => r.status === "unknown" || r.status === "catch_all").length,
  };
}

// ─── EmailVerifier implementation ───────────────────────

export function createDeBounceVerifier(apiKey: string): EmailVerifier {
  return {
    name: "debounce",
    verifySingle: (email: string) => validateEmail(apiKey, email),
    verifyBatch: (emails: string[]) => validateEmailBatch(apiKey, emails),
    getCredits: () => getDeBounceCredits(apiKey),
  };
}
