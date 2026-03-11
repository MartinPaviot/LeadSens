/**
 * NeverBounce Connector — Email verification API.
 *
 * Endpoints used:
 * - GET  /v4/account/info — Test connection + get credits
 * - POST /v4/single/check — Single email verification
 *
 * Auth: Query param `key=API_KEY`
 * API docs: https://developers.neverbounce.com/reference
 */

import { z } from "zod/v4";
import type { VerificationResult, VerificationStatus, VerifyBatchResult, EmailVerifier } from "../providers/email-verifier";
import { sleep, BATCH_VERIFY_DELAY_MS } from "./fetch-retry";

const NB_BASE = "https://api.neverbounce.com/v4";
const MAX_RETRIES = 3;

// ─── API Response Schemas ───────────────────────────────

const nbAccountSchema = z.object({
  status: z.string(),
  credits_info: z.object({
    free_credits_remaining: z.number().optional(),
    paid_credits_remaining: z.number().optional(),
    free_credits_used: z.number().optional(),
  }).optional(),
});

const nbSingleSchema = z.object({
  status: z.string(),
  result: z.string(), // "valid", "invalid", "disposable", "catchall", "unknown"
  flags: z.array(z.string()).optional(),
});

// ─── Status Mapping ─────────────────────────────────────

function mapStatus(nbResult: string): VerificationStatus {
  switch (nbResult.toLowerCase()) {
    case "valid":
      return "valid";
    case "invalid":
      return "invalid";
    case "disposable":
      return "disposable";
    case "catchall":
      return "catch_all";
    case "unknown":
    default:
      return "unknown";
  }
}

// ─── Public API ─────────────────────────────────────────

/**
 * Test NeverBounce API key by fetching account info.
 */
export async function testNeverBounceConnection(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${NB_BASE}/account/info?key=${encodeURIComponent(apiKey)}`);
    if (!res.ok) return false;
    const json = await res.json();
    const parsed = nbAccountSchema.safeParse(json);
    return parsed.success && parsed.data.status === "success";
  } catch {
    return false;
  }
}

/**
 * Get remaining NeverBounce credits.
 */
export async function getNeverBounceCredits(apiKey: string): Promise<number> {
  const res = await fetch(`${NB_BASE}/account/info?key=${encodeURIComponent(apiKey)}`);
  if (!res.ok) throw new Error(`NeverBounce account/info returned ${res.status}`);
  const json = await res.json();
  const parsed = nbAccountSchema.parse(json);
  const credits = parsed.credits_info;
  return (credits?.free_credits_remaining ?? 0) + (credits?.paid_credits_remaining ?? 0);
}

/**
 * Validate a single email address.
 */
export async function validateEmail(
  apiKey: string,
  email: string,
): Promise<VerificationResult> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${NB_BASE}/single/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: apiKey, email }),
    });

    if (res.ok) {
      const json = await res.json();
      const parsed = nbSingleSchema.parse(json);
      return {
        email,
        status: mapStatus(parsed.result),
        subStatus: parsed.flags?.join(", ") || undefined,
      };
    }

    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      await sleep(Math.pow(2, attempt) * 1000);
      continue;
    }

    throw new Error(`NeverBounce single/check returned ${res.status}`);
  }

  throw new Error("NeverBounce single/check failed after retries");
}

/**
 * Validate a batch of emails (loops single checks — NeverBounce bulk is async/job-based).
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

export function createNeverBounceVerifier(apiKey: string): EmailVerifier {
  return {
    name: "neverbounce",
    verifySingle: (email: string) => validateEmail(apiKey, email),
    verifyBatch: (emails: string[]) => validateEmailBatch(apiKey, emails),
    getCredits: () => getNeverBounceCredits(apiKey),
  };
}
