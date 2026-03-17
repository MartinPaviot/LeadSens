/**
 * ZeroBounce Connector — Email verification API.
 *
 * Endpoints used:
 * - GET /v2/validate — Single email validation
 * - POST /v2/validatebatch — Batch validation (up to 100 emails per call)
 * - GET /v2/getcredits — Get remaining credits
 *
 * API docs: https://www.zerobounce.net/docs/email-validation-api-quickstart/
 */

import { z } from "zod/v4";
import type { VerificationResult, VerificationStatus, VerifyBatchResult, EmailVerifier } from "../providers/email-verifier";

const ZB_BASE = "https://api.zerobounce.net";

// ─── API Response Schema ────────────────────────────────

const zbSingleSchema = z.object({
  address: z.string(),
  status: z.string(), // "valid", "invalid", "catch-all", "unknown", "spamtrap", "abuse", "do_not_mail"
  sub_status: z.string().optional(),
  free_email: z.boolean().optional(),
  did_you_mean: z.string().nullish(),
});

const zbBatchItemSchema = z.object({
  address: z.string(),
  status: z.string(),
  sub_status: z.string().optional(),
  free_email: z.boolean().optional(),
  did_you_mean: z.string().nullish(),
});

const zbBatchSchema = z.object({
  email_batch: z.array(zbBatchItemSchema),
});

const zbCreditsSchema = z.object({
  Credits: z.union([z.string(), z.number()]),
});

// ─── Status Mapping ─────────────────────────────────────

function mapStatus(zbStatus: string): VerificationStatus {
  switch (zbStatus.toLowerCase()) {
    case "valid":
      return "valid";
    case "invalid":
      return "invalid";
    case "catch-all":
      return "catch_all";
    case "spamtrap":
      return "spamtrap";
    case "abuse":
      return "abuse";
    case "do_not_mail":
      return "invalid"; // do_not_mail = disposable/role-based → treat as invalid
    case "unknown":
    default:
      return "unknown";
  }
}

function toVerificationResult(item: {
  address: string;
  status: string;
  sub_status?: string;
  free_email?: boolean;
  did_you_mean?: string | null;
}): VerificationResult {
  return {
    email: item.address,
    status: mapStatus(item.status),
    subStatus: item.sub_status,
    freeEmail: item.free_email,
    didYouMean: item.did_you_mean ?? undefined,
  };
}

// ─── Public API ─────────────────────────────────────────

/**
 * Test ZeroBounce API key by fetching credits.
 * Returns true if the key is valid (even with 0 credits).
 */
export async function testZeroBounceConnection(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${ZB_BASE}/v2/getcredits?api_key=${encodeURIComponent(apiKey)}`);
    if (!res.ok) return false;
    const json = await res.json();
    const parsed = zbCreditsSchema.safeParse(json);
    return parsed.success;
  } catch {
    return false;
  }
}

/**
 * Get remaining ZeroBounce credits.
 */
export async function getZeroBounceCredits(apiKey: string): Promise<number> {
  const res = await fetch(`${ZB_BASE}/v2/getcredits?api_key=${encodeURIComponent(apiKey)}`);
  if (!res.ok) throw new Error(`ZeroBounce getcredits returned ${res.status}`);
  const json = await res.json();
  const parsed = zbCreditsSchema.parse(json);
  return typeof parsed.Credits === "number" ? parsed.Credits : parseInt(parsed.Credits, 10);
}

/**
 * Validate a single email address.
 */
export async function validateEmail(
  apiKey: string,
  email: string,
): Promise<VerificationResult> {
  const url = `${ZB_BASE}/v2/validate?api_key=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ZeroBounce validate returned ${res.status}`);
  const json = await res.json();
  const parsed = zbSingleSchema.parse(json);
  return toVerificationResult(parsed);
}

/**
 * Validate a batch of emails (max 100 per call).
 * Automatically chunks if more than 100 emails are provided.
 */
export async function validateEmailBatch(
  apiKey: string,
  emails: string[],
): Promise<VerifyBatchResult> {
  const allResults: VerificationResult[] = [];
  const BATCH_SIZE = 100;

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const chunk = emails.slice(i, i + BATCH_SIZE);
    const emailBatch = chunk.map((email) => ({ email_address: email }));

    const res = await fetch(`${ZB_BASE}/v2/validatebatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        email_batch: emailBatch,
      }),
    });

    if (!res.ok) {
      throw new Error(`ZeroBounce validatebatch returned ${res.status}`);
    }

    const json = await res.json();
    const parsed = zbBatchSchema.parse(json);
    allResults.push(...parsed.email_batch.map(toVerificationResult));
  }

  return {
    results: allResults,
    validCount: allResults.filter((r) => r.status === "valid").length,
    invalidCount: allResults.filter((r) => r.status === "invalid").length,
    unknownCount: allResults.filter((r) => r.status === "unknown" || r.status === "catch_all").length,
  };
}

// ─── EmailVerifier implementation ───────────────────────

export function createZeroBounceVerifier(apiKey: string): EmailVerifier {
  return {
    name: "zerobounce",
    verifySingle: (email: string) => validateEmail(apiKey, email),
    verifyBatch: (emails: string[]) => validateEmailBatch(apiKey, emails),
    getCredits: () => getZeroBounceCredits(apiKey),
  };
}
