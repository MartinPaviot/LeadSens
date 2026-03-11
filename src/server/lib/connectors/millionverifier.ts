/**
 * MillionVerifier Connector — Email verification API.
 *
 * Endpoints used:
 * - GET /api/v3/?api=X&email=Y — Single email verification
 * - GET /api/v3/credits?api=X  — Get remaining credits
 *
 * Auth: Query param `api=API_KEY`
 * API docs: https://www.millionverifier.com/api
 */

import { z } from "zod/v4";
import type { VerificationResult, VerificationStatus, VerifyBatchResult, EmailVerifier } from "../providers/email-verifier";
import { sleep, BATCH_VERIFY_DELAY_MS } from "./fetch-retry";

const MV_BASE = "https://api.millionverifier.com/api/v3";
const MAX_RETRIES = 3;

// ─── API Response Schemas ───────────────────────────────

const mvSingleSchema = z.object({
  email: z.string(),
  quality: z.string().optional(), // "good", "bad", "unknown", "disposable", "catch_all"
  result: z.string(), // "ok", "catch_all", "invalid", "disposable", "unknown"
  resultcode: z.number().optional(),
  free: z.boolean().optional(),
  role: z.boolean().optional(),
});

const mvCreditsSchema = z.object({
  credits: z.union([z.string(), z.number()]),
});

// ─── Status Mapping ─────────────────────────────────────

function mapStatus(result: string): VerificationStatus {
  switch (result.toLowerCase()) {
    case "ok":
      return "valid";
    case "invalid":
      return "invalid";
    case "disposable":
      return "disposable";
    case "catch_all":
      return "catch_all";
    case "unknown":
    default:
      return "unknown";
  }
}

// ─── Public API ─────────────────────────────────────────

/**
 * Test MillionVerifier API key by checking credits.
 */
export async function testMillionVerifierConnection(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${MV_BASE}/credits?api=${encodeURIComponent(apiKey)}`);
    if (!res.ok) return false;
    const json = await res.json();
    const parsed = mvCreditsSchema.safeParse(json);
    return parsed.success;
  } catch {
    return false;
  }
}

/**
 * Get remaining MillionVerifier credits.
 */
export async function getMillionVerifierCredits(apiKey: string): Promise<number> {
  const res = await fetch(`${MV_BASE}/credits?api=${encodeURIComponent(apiKey)}`);
  if (!res.ok) throw new Error(`MillionVerifier credits returned ${res.status}`);
  const json = await res.json();
  const parsed = mvCreditsSchema.parse(json);
  return typeof parsed.credits === "number" ? parsed.credits : parseInt(parsed.credits, 10);
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
      `${MV_BASE}/?api=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}`,
    );

    if (res.ok) {
      const json = await res.json();
      const parsed = mvSingleSchema.parse(json);
      return {
        email: parsed.email,
        status: mapStatus(parsed.result),
        freeEmail: parsed.free ?? undefined,
      };
    }

    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      await sleep(Math.pow(2, attempt) * 1000);
      continue;
    }

    throw new Error(`MillionVerifier validate returned ${res.status}`);
  }

  throw new Error("MillionVerifier validate failed after retries");
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

export function createMillionVerifierVerifier(apiKey: string): EmailVerifier {
  return {
    name: "millionverifier",
    verifySingle: (email: string) => validateEmail(apiKey, email),
    verifyBatch: (emails: string[]) => validateEmailBatch(apiKey, emails),
    getCredits: () => getMillionVerifierCredits(apiKey),
  };
}
