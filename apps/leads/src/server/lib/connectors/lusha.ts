/**
 * Lusha Connector — Person enrichment via Lusha API.
 *
 * Endpoints used:
 * - GET  /person — Test connection (minimal params)
 * - POST /person — Enrich a person by email/name/company
 *
 * Auth: `api_key: KEY` header
 * API docs: https://www.lusha.com/docs/
 */

import { z } from "zod/v4";
import { logger } from "@/lib/logger";
import type { EnrichmentProvider, EnrichmentResult } from "../providers/enrichment-provider";
import { sleep } from "./fetch-retry";

const LUSHA_BASE = "https://api.lusha.com";
const REQUEST_TIMEOUT = 15_000;
const BATCH_DELAY_MS = 200;

// ─── Zod schemas for API response validation ────────────

const lushaEmailSchema = z.object({
  email: z.string().nullish(),
  type: z.string().nullish(),
});

const lushaPhoneSchema = z.object({
  internationalNumber: z.string().nullish(),
  countryCallingCode: z.string().nullish(),
  type: z.string().nullish(),
});

const lushaPersonSchema = z.object({
  emailAddresses: z.array(lushaEmailSchema).nullish(),
  phoneNumbers: z.array(lushaPhoneSchema).nullish(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  jobTitle: z.string().nullish(),
  companyName: z.string().nullish(),
});

// ─── API Helpers ────────────────────────────────────────

async function lushaFetch(
  apiKey: string,
  path: string,
  method: "GET" | "POST" = "POST",
  body?: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${LUSHA_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      api_key: apiKey,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Lusha API ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

// ─── Public API ─────────────────────────────────────────

/**
 * Test Lusha API key validity.
 * Uses a GET /person with a test email — 200 means the key is valid.
 */
export async function testLushaConnection(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${LUSHA_BASE}/person?email=${encodeURIComponent("test@example.com")}`,
      {
        method: "GET",
        headers: { api_key: apiKey },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      },
    );
    // 200 or 404 (no results) both indicate a valid key.
    // 401/403 = invalid key.
    return res.status !== 401 && res.status !== 403;
  } catch {
    return false;
  }
}

/**
 * Enrich a single person via POST /person.
 * Returns null if the person is not found or on error.
 */
export async function enrichPerson(
  apiKey: string,
  params: {
    email: string;
    firstName?: string;
    lastName?: string;
    company?: string;
  },
): Promise<EnrichmentResult | null> {
  try {
    const body: Record<string, unknown> = { email: params.email };
    if (params.firstName) body.firstName = params.firstName;
    if (params.lastName) body.lastName = params.lastName;
    if (params.company) body.company = params.company;

    const raw = await lushaFetch(apiKey, "/person", "POST", body);
    const parsed = lushaPersonSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn(`[lusha] Person response validation failed: ${parsed.error.message}`);
      return null;
    }

    const p = parsed.data;

    const data: Record<string, unknown> = {};
    if (p.firstName) data.firstName = p.firstName;
    if (p.lastName) data.lastName = p.lastName;
    if (p.jobTitle) data.jobTitle = p.jobTitle;
    if (p.companyName) data.companyName = p.companyName;

    if (p.emailAddresses?.length) {
      data.emailAddresses = p.emailAddresses
        .filter((e) => e.email)
        .map((e) => ({ email: e.email, type: e.type ?? undefined }));
    }

    if (p.phoneNumbers?.length) {
      data.phoneNumbers = p.phoneNumbers
        .filter((ph) => ph.internationalNumber)
        .map((ph) => ({
          number: ph.internationalNumber,
          countryCode: ph.countryCallingCode ?? undefined,
          type: ph.type ?? undefined,
        }));
    }

    // Confidence: higher if we got both email and phone data
    const hasEmail = (p.emailAddresses?.length ?? 0) > 0;
    const hasPhone = (p.phoneNumbers?.length ?? 0) > 0;
    const confidence = hasEmail && hasPhone ? 0.9 : hasEmail || hasPhone ? 0.7 : 0.4;

    return {
      email: params.email,
      data,
      confidence,
    };
  } catch (err) {
    logger.warn(`[lusha] Person enrichment failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ─── EnrichmentProvider implementation ──────────────────

/**
 * Create a Lusha EnrichmentProvider instance.
 * Implements the EnrichmentProvider interface for use in the provider registry.
 */
export function createLushaEnrichment(apiKey: string): EnrichmentProvider {
  return {
    name: "lusha",

    async enrichSingle(email: string): Promise<EnrichmentResult> {
      const result = await enrichPerson(apiKey, { email });
      return result ?? { email, data: {}, confidence: 0 };
    },

    async enrichBatch(emails: string[]): Promise<EnrichmentResult[]> {
      const results: EnrichmentResult[] = [];

      for (let i = 0; i < emails.length; i++) {
        if (i > 0) await sleep(BATCH_DELAY_MS);
        const result = await enrichPerson(apiKey, { email: emails[i] });
        results.push(result ?? { email: emails[i], data: {}, confidence: 0 });
      }

      return results;
    },
  };
}
