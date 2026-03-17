/**
 * Seamless.AI Connector — Contact enrichment via Seamless.AI API.
 *
 * Endpoints used:
 * - GET  /v1/contacts/search — Test API key validity (minimal params)
 * - POST /v1/contacts/search — Search contacts by company, department, seniority
 *
 * API docs: https://docs.seamless.ai
 * Auth: `Authorization: Bearer KEY` header
 *
 * Note: Seamless.AI requires an API license. testConnection handles 403 gracefully.
 */

import { z } from "zod/v4";
import { logger } from "@/lib/logger";
import { sleep } from "./fetch-retry";
import type {
  EnrichmentProvider,
  EnrichmentResult,
} from "../providers/enrichment-provider";

const SEAMLESS_BASE = "https://api.seamless.ai";
const MAX_RETRIES = 3;

// ─── Zod schemas for API response validation ────────────

const seamlessContactSchema = z.object({
  id: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  title: z.string().nullish(),
  seniority: z.string().nullish(),
  department: z.string().nullish(),
  linkedin_url: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  country: z.string().nullish(),
  company_name: z.string().nullish(),
  company_domain: z.string().nullish(),
  company_industry: z.string().nullish(),
  company_size: z.string().nullish(),
  company_revenue: z.string().nullish(),
});

const seamlessSearchResponseSchema = z.object({
  data: z.array(seamlessContactSchema).nullish(),
  total: z.number().nullish(),
});

// ─── API Helpers ────────────────────────────────────────

async function seamlessFetch(
  apiKey: string,
  path: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>,
): Promise<unknown> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${SEAMLESS_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.ok) {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    }

    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      await sleep(Math.pow(2, attempt) * 1000);
      continue;
    }

    const text = await res.text().catch(() => "");
    throw new Error(
      `Seamless.AI ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`,
    );
  }

  throw new Error(
    `Seamless.AI ${method} ${path} → max retries exceeded`,
  );
}

// ─── Public API ─────────────────────────────────────────

/**
 * Test Seamless.AI API key validity.
 * Makes a minimal search request. Handles 403 gracefully (API license required).
 */
export async function testSeamlessConnection(
  apiKey: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${SEAMLESS_BASE}/v1/contacts/search?limit=1`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });

    // 403 = valid key but API license not enabled — treat as successful auth
    if (res.status === 403) {
      logger.info("[seamless-ai] API key valid but license may be required (403)");
      return true;
    }

    return res.ok;
  } catch {
    return false;
  }
}

// ─── EnrichmentProvider ─────────────────────────────────

class SeamlessEnrichment implements EnrichmentProvider {
  readonly name = "Seamless.AI";
  constructor(private readonly apiKey: string) {}

  async enrichSingle(email: string): Promise<EnrichmentResult> {
    try {
      const raw = await seamlessFetch(
        this.apiKey,
        "/v1/contacts/search",
        "POST",
        { email, limit: 1 },
      );

      const parsed = seamlessSearchResponseSchema.safeParse(raw);
      if (!parsed.success || !parsed.data.data?.length) {
        return { email, data: {} };
      }

      const contact = parsed.data.data[0];
      const data: Record<string, unknown> = {};

      if (contact.first_name) data.firstName = contact.first_name;
      if (contact.last_name) data.lastName = contact.last_name;
      if (contact.title) data.title = contact.title;
      if (contact.seniority) data.seniority = contact.seniority;
      if (contact.department) data.department = contact.department;
      if (contact.phone) data.phone = contact.phone;
      if (contact.linkedin_url) data.linkedinUrl = contact.linkedin_url;
      if (contact.city) data.city = contact.city;
      if (contact.state) data.state = contact.state;
      if (contact.country) data.country = contact.country;
      if (contact.company_name) data.companyName = contact.company_name;
      if (contact.company_domain) data.companyDomain = contact.company_domain;
      if (contact.company_industry) data.companyIndustry = contact.company_industry;
      if (contact.company_size) data.companySize = contact.company_size;
      if (contact.company_revenue) data.companyRevenue = contact.company_revenue;

      return {
        email: contact.email ?? email,
        data,
        confidence: Object.keys(data).length > 5 ? 0.9 : 0.6,
      };
    } catch (err) {
      logger.warn(
        `[seamless-ai] Enrichment failed for ${email}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { email, data: {} };
    }
  }

  async enrichBatch(emails: string[]): Promise<EnrichmentResult[]> {
    const results: EnrichmentResult[] = [];

    for (const email of emails) {
      const result = await this.enrichSingle(email);
      results.push(result);
      // Rate-limit: 200ms between calls to avoid hammering the API
      if (emails.indexOf(email) < emails.length - 1) {
        await sleep(200);
      }
    }

    return results;
  }

  async getCredits(): Promise<number> {
    // Seamless.AI does not expose a credits endpoint — return -1 to indicate unknown
    return -1;
  }
}

/**
 * Create a Seamless.AI EnrichmentProvider instance.
 */
export function createSeamlessEnrichment(
  apiKey: string,
): EnrichmentProvider {
  return new SeamlessEnrichment(apiKey);
}
