/**
 * ZoomInfo Enrichment Connector — OAuth + PKCE, JWT-based auth.
 *
 * API docs: https://api.zoominfo.com
 * Auth: OAuth 2.0 with PKCE → JWT token (24h lifespan)
 * Search: POST /search/contact, POST /search/company
 * Enrich: POST /enrich/contacts (batch up to 25)
 *
 * Implements EnrichmentProvider for the provider registry.
 */

import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { sleep } from "./fetch-retry";
import type {
  EnrichmentProvider,
  EnrichmentResult,
} from "../providers/enrichment-provider";

// ─── Constants ──────────────────────────────────────────

const ZOOMINFO_AUTH_URL = "https://api.zoominfo.com/authenticate";
const ZOOMINFO_BASE = "https://api.zoominfo.com";
const REQUEST_TIMEOUT = 15_000;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;
/** Max contacts per /enrich/contacts batch */
const ENRICH_BATCH_SIZE = 25;
/** Delay between batch chunks to respect rate limits */
const BATCH_CHUNK_DELAY_MS = 500;

// ─── Zod Schemas ────────────────────────────────────────

const tokenResponseSchema = z.object({
  jwt: z.string(),
  expiresIn: z.number().optional(),
});

const zoomInfoContactSchema = z.object({
  id: z.coerce.string().optional(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  directPhoneNumber: z.string().nullish(),
  jobTitle: z.string().nullish(),
  managementLevel: z.string().nullish(),
  companyId: z.coerce.string().nullish(),
  companyName: z.string().nullish(),
  companyRevenue: z.number().nullish(),
  companyEmployeeCount: z.number().nullish(),
  industry: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  country: z.string().nullish(),
  linkedInUrl: z.string().nullish(),
});

const searchResponseSchema = z.object({
  maxResults: z.number().optional(),
  totalResults: z.number().optional(),
  data: z.array(zoomInfoContactSchema).optional(),
});

const enrichResponseSchema = z.object({
  success: z.boolean().optional(),
  data: z.object({
    result: z.array(z.object({
      input: z.record(z.string(), z.unknown()).optional(),
      data: z.array(zoomInfoContactSchema).optional(),
      matchStatus: z.string().optional(),
    })).optional(),
  }).optional(),
});

const creditsResponseSchema = z.object({
  bulkCreditsRemaining: z.number().optional(),
  matchCreditsRemaining: z.number().optional(),
});

// ─── OAuth Helpers ──────────────────────────────────────

/**
 * Build the ZoomInfo OAuth authorization URL with PKCE.
 *
 * Note: ZoomInfo uses a non-standard auth flow. Their primary auth is
 * username/password → JWT. For OAuth integrations with PKCE, this builds
 * the redirect URL. Some ZoomInfo plans use standard OAuth; adapt as needed.
 */
export function getAuthUrl(
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${ZOOMINFO_AUTH_URL}?${params}`;
}

/**
 * Exchange an authorization code for a JWT token (with PKCE code_verifier).
 */
export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const res = await fetch(ZOOMINFO_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ZoomInfo OAuth exchange failed: ${res.status} ${text.slice(0, 300)}`);
  }

  const raw = await res.json();
  const parsed = tokenResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`ZoomInfo OAuth response validation failed: ${parsed.error.message}`);
  }

  // ZoomInfo JWT tokens are typically 24h; refresh token may be separate or same endpoint
  const expiresIn = parsed.data.expiresIn ?? 86400; // default 24h

  return {
    accessToken: parsed.data.jwt,
    refreshToken: parsed.data.jwt, // ZoomInfo re-authenticates; store JWT as refresh fallback
    expiresIn,
  };
}

// ─── Token Management ───────────────────────────────────

async function refreshAccessToken(integration: {
  id: string;
  refreshToken: string | null;
}): Promise<string> {
  if (!integration.refreshToken) {
    throw new Error("No refresh token available for ZoomInfo");
  }

  const clientId = process.env.ZOOMINFO_CLIENT_ID;
  const clientSecret = process.env.ZOOMINFO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "ZoomInfo OAuth credentials not configured (ZOOMINFO_CLIENT_ID / ZOOMINFO_CLIENT_SECRET)",
    );
  }

  // ZoomInfo uses re-authentication for token refresh
  const res = await fetch(ZOOMINFO_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ZoomInfo token refresh failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const raw = await res.json();
  const parsed = tokenResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`ZoomInfo refresh response validation failed: ${parsed.error.message}`);
  }

  const expiresIn = parsed.data.expiresIn ?? 86400;

  // Persist new token encrypted
  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      accessToken: encrypt(parsed.data.jwt),
      refreshToken: encrypt(parsed.data.jwt),
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    },
  });

  logger.debug("[zoominfo] JWT token refreshed successfully");
  return parsed.data.jwt;
}

async function getAccessToken(workspaceId: string): Promise<string> {
  const integration = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId, type: "ZOOMINFO" } },
  });

  if (!integration?.accessToken) {
    throw new Error("ZoomInfo not connected");
  }

  // Auto-refresh if expires within 30 minutes (24h token, generous buffer)
  if (
    integration.expiresAt &&
    integration.expiresAt.getTime() - Date.now() < 30 * 60 * 1000
  ) {
    return refreshAccessToken(integration);
  }

  return decrypt(integration.accessToken);
}

// ─── API Client ─────────────────────────────────────────

async function zoomInfoFetch(
  accessToken: string,
  path: string,
  method: "GET" | "POST" = "POST",
  body?: Record<string, unknown>,
): Promise<unknown> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${ZOOMINFO_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await sleep(Math.pow(2, attempt) * BASE_DELAY_MS);
        continue;
      }
      throw new Error(
        `ZoomInfo ${method} ${path} failed: ${err instanceof Error ? err.message : "network error"}`,
      );
    }

    if (res.ok) {
      const contentType = res.headers.get("content-type");
      if (!contentType?.includes("json")) return {};
      return res.json();
    }

    // Retry on 429 or 5xx
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      const retryAfter = res.headers.get("retry-after");
      const delay = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.pow(2, attempt) * BASE_DELAY_MS;
      await sleep(delay);
      continue;
    }

    const text = await res.text().catch(() => "");
    throw new Error(
      `ZoomInfo ${method} ${path} returned ${res.status}: ${text.slice(0, 200)}`,
    );
  }

  throw new Error(`ZoomInfo ${method} ${path} failed after ${MAX_RETRIES} retries`);
}

// ─── Connection Test ────────────────────────────────────

export async function testZoomInfoConnection(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${ZOOMINFO_BASE}/lookup/inputfields/contact/enrich`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Raw Search / Enrich Helpers ────────────────────────

/**
 * Search contacts by email via POST /search/contact.
 */
async function searchContactByEmail(
  accessToken: string,
  email: string,
): Promise<z.Infer<typeof zoomInfoContactSchema> | null> {
  try {
    const raw = await zoomInfoFetch(accessToken, "/search/contact", "POST", {
      emailAddress: [email],
      rpp: 1, // results per page
      page: 1,
    });

    const parsed = searchResponseSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn(`[zoominfo] Search response validation failed: ${parsed.error.message}`);
      return null;
    }

    return parsed.data.data?.[0] ?? null;
  } catch (err) {
    logger.warn(
      `[zoominfo] searchContactByEmail failed for ${email}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/**
 * Enrich contacts in batch via POST /enrich/contacts.
 * Max 25 per request.
 */
async function enrichContactsBatch(
  accessToken: string,
  emails: string[],
): Promise<Map<string, z.Infer<typeof zoomInfoContactSchema>>> {
  const results = new Map<string, z.Infer<typeof zoomInfoContactSchema>>();

  try {
    const matchPersonInput = emails.map((email) => ({
      emailAddress: email,
    }));

    const raw = await zoomInfoFetch(accessToken, "/enrich/contacts", "POST", {
      matchPersonInput,
      outputFields: [
        "id",
        "firstName",
        "lastName",
        "email",
        "phone",
        "directPhoneNumber",
        "jobTitle",
        "managementLevel",
        "companyId",
        "companyName",
        "companyRevenue",
        "companyEmployeeCount",
        "industry",
        "city",
        "state",
        "country",
        "linkedInUrl",
      ],
    });

    const parsed = enrichResponseSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn(`[zoominfo] Enrich batch validation failed: ${parsed.error.message}`);
      return results;
    }

    for (const result of parsed.data.data?.result ?? []) {
      const inputEmail = result.input?.["emailAddress"] as string | undefined;
      const contact = result.data?.[0];
      if (inputEmail && contact) {
        results.set(inputEmail.toLowerCase(), contact);
      }
    }
  } catch (err) {
    logger.warn(
      `[zoominfo] enrichContactsBatch failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return results;
}

// ─── Contact → EnrichmentResult Mapper ──────────────────

function contactToEnrichmentResult(
  email: string,
  contact: z.Infer<typeof zoomInfoContactSchema> | null,
): EnrichmentResult {
  if (!contact) {
    return { email, data: {}, confidence: 0 };
  }

  const data: Record<string, unknown> = {};

  if (contact.firstName) data.firstName = contact.firstName;
  if (contact.lastName) data.lastName = contact.lastName;
  if (contact.email) data.email = contact.email;
  if (contact.phone) data.phone = contact.phone;
  if (contact.directPhoneNumber) data.directPhone = contact.directPhoneNumber;
  if (contact.jobTitle) data.jobTitle = contact.jobTitle;
  if (contact.managementLevel) data.managementLevel = contact.managementLevel;
  if (contact.companyId) data.companyId = contact.companyId;
  if (contact.companyName) data.companyName = contact.companyName;
  if (contact.companyRevenue != null) data.companyRevenue = contact.companyRevenue;
  if (contact.companyEmployeeCount != null) data.companyEmployeeCount = contact.companyEmployeeCount;
  if (contact.industry) data.industry = contact.industry;
  if (contact.city) data.city = contact.city;
  if (contact.state) data.state = contact.state;
  if (contact.country) data.country = contact.country;
  if (contact.linkedInUrl) data.linkedInUrl = contact.linkedInUrl;

  // Confidence scoring based on data completeness
  let fieldCount = 0;
  const keyFields = ["jobTitle", "companyName", "phone", "linkedInUrl", "industry"];
  for (const key of keyFields) {
    if (data[key]) fieldCount++;
  }

  const confidence = fieldCount >= 4 ? 0.95 : fieldCount >= 3 ? 0.85 : fieldCount >= 2 ? 0.7 : fieldCount >= 1 ? 0.5 : 0.2;

  return { email, data, confidence };
}

// ─── EnrichmentProvider Implementation ──────────────────

/**
 * Create a ZoomInfo EnrichmentProvider instance.
 * Uses workspace-level OAuth tokens with auto-refresh.
 */
export function createZoomInfoEnrichment(workspaceId: string): EnrichmentProvider {
  return {
    name: "zoominfo",

    async enrichSingle(email: string): Promise<EnrichmentResult> {
      try {
        const token = await getAccessToken(workspaceId);
        const contact = await searchContactByEmail(token, email);
        return contactToEnrichmentResult(email, contact);
      } catch (err) {
        logger.warn(
          `[zoominfo] enrichSingle failed for ${email}: ${err instanceof Error ? err.message : String(err)}`,
        );
        return { email, data: {}, confidence: 0 };
      }
    },

    async enrichBatch(emails: string[]): Promise<EnrichmentResult[]> {
      try {
        const token = await getAccessToken(workspaceId);
        const allResults: EnrichmentResult[] = [];

        // Process in chunks of ENRICH_BATCH_SIZE (25)
        for (let i = 0; i < emails.length; i += ENRICH_BATCH_SIZE) {
          if (i > 0) await sleep(BATCH_CHUNK_DELAY_MS);

          const chunk = emails.slice(i, i + ENRICH_BATCH_SIZE);
          const batchMap = await enrichContactsBatch(token, chunk);

          for (const email of chunk) {
            const contact = batchMap.get(email.toLowerCase()) ?? null;
            allResults.push(contactToEnrichmentResult(email, contact));
          }
        }

        return allResults;
      } catch (err) {
        logger.error(
          `[zoominfo] enrichBatch failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        // Return empty results for all emails on total failure
        return emails.map((email) => ({ email, data: {}, confidence: 0 }));
      }
    },

    async getCredits(): Promise<number> {
      try {
        const token = await getAccessToken(workspaceId);
        const raw = await zoomInfoFetch(token, "/lookup/usage", "GET");
        const parsed = creditsResponseSchema.safeParse(raw);
        if (!parsed.success) {
          logger.warn(`[zoominfo] Credits response validation failed: ${parsed.error.message}`);
          return -1;
        }

        // Return whichever credit pool is relevant (bulk or match)
        return parsed.data.bulkCreditsRemaining ?? parsed.data.matchCreditsRemaining ?? -1;
      } catch (err) {
        logger.warn(
          `[zoominfo] getCredits failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        return -1;
      }
    },
  };
}
