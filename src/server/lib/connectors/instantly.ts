import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

const BASE_URL = "https://api.instantly.ai/api/v2";
const MAX_RETRIES = 3;

// ─── Search Filters Schema ───────────────────────────────
// Mapped from Instantly API v2 docs (developer.instantly.ai)

// Include/exclude for string arrays (title, industry, company_name, etc.)
const includeExcludeStrings = z.object({
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
});

// Include/exclude for single strings (keyword_filter)
const includeExcludeString = z.object({
  include: z.string().optional(),
  exclude: z.string().optional(),
});

// Location object — Instantly requires Google Maps place_id
const locationObjectSchema = z.object({
  place_id: z.string(),
  label: z.string().optional(),
});

export const searchFiltersSchema = z.object({
  // ── Person filters ──
  title: includeExcludeStrings.optional(),            // Job titles (include/exclude)
  level: z.array(z.string()).optional(),              // "C-Level", "VP-Level", "Director-Level", "Manager-Level", "Staff", "Entry level", "Mid-Senior level", "Director", "Associate", "Owner", "Partner", "Senior", "Intern", "Training", "Unpaid", "Volunteer", "Board Member", "Founder"
  department: z.array(z.enum([
    "Engineering", "Finance & Administration", "Human Resources",
    "IT & IS", "Marketing", "Operations", "Sales", "Support", "Other",
  ])).optional(),
  name: z.array(z.string()).optional(),               // Contact name filter

  // ── Company filters ──
  industry: includeExcludeStrings.optional(),         // Industry (include/exclude)
  subIndustry: includeExcludeStrings.optional(),      // Sub-industry (include/exclude)
  employeeCount: z.array(z.enum([
    "0 - 25", "25 - 100", "100 - 250", "250 - 1000",
    "1K - 10K", "10K - 50K", "50K - 100K", "> 100K",
  ])).optional(),
  revenue: z.array(z.enum([
    "$0 - 1M", "$1 - 10M", "$10 - 50M", "$50 - 100M",
    "$100 - 250M", "$250 - 500M", "$500M - 1B", "> $1B",
  ])).optional(),
  funding_type: z.array(z.string()).optional(),
  company_name: includeExcludeStrings.optional(),     // Company name (include/exclude)
  domains: z.array(z.string()).optional(),            // Company domains

  // ── Location filters ──
  // Accepts plain strings (from LLM) or place_id objects (for API).
  // Plain strings are resolved to place_id objects before API calls.
  locations: z.union([
    z.array(z.string()),                                       // LLM-friendly: ["France", "Germany"]
    z.array(locationObjectSchema),                             // API format: [{place_id, label}]
    z.object({
      include: z.array(locationObjectSchema).optional(),
      exclude: z.array(locationObjectSchema).optional(),
    }),
  ]).optional(),
  location_mode: z.enum(["contact", "company_hq"]).optional(),

  // ── Advanced filters ──
  keyword_filter: includeExcludeString.optional(),    // Keyword (include/exclude strings)
  technologies: z.array(z.string()).optional(),       // Tech stack
  look_alike: z.string().optional(),                  // Lookalike domain
  news: z.array(z.string()).optional(),               // News filters (enum: "launches", "hires", "receives_financing", etc.)
  job_listing: z.string().optional(),                 // Job listing keyword

  // ── Deduplication ──
  skip_owned_leads: z.boolean().optional().default(true),
  show_one_lead_per_company: z.boolean().optional(),
});

export type InstantlySearchFilters = z.infer<typeof searchFiltersSchema>;

// ─── Location Resolver ──────────────────────────────────
// Google Place IDs for common countries/regions used in B2B prospecting.
// Instantly requires {place_id, label} objects.
// For locations not in this map, the Google Places API is needed.
const LOCATION_PLACE_IDS: Record<string, string> = {
  // Europe
  "france": "ChIJMVd4MymgVA0R99lHx5Y__Ws",
  "germany": "ChIJa76xwh5ymkcRW-e3tIrhADA",
  "united kingdom": "ChIJqZHHQhE7WgIReiWIMkOg-MQ",
  "uk": "ChIJqZHHQhE7WgIReiWIMkOg-MQ",
  "spain": "ChIJi7xhMnjjQgwR7KNoB5Qs7KY",
  "italy": "ChIJA9KNRIL-1BIRb15jJFxPAQ0",
  "netherlands": "ChIJu-SH28MJxkcRnwq9_851obM",
  "belgium": "ChIJl5fz7WR9wUcR4fvh6log5dc",
  "switzerland": "ChIJYW1Zb-9kjEcRFXvLDxG1Vlw",
  "sweden": "ChIJ8fA1bTmyXEYRYm-tjaLruCI",
  "norway": "ChIJv-VNj0VoEkYRK9BxxkR3JEY",
  "denmark": "ChIJ-1-e7-1lS0YRzE5CH7fGJgQ",
  "finland": "ChIJ3fYyS9_KgUYREKh1PNZGAQA",
  "austria": "ChIJfyqdJZsHbUcRr19nl14GhtA",
  "ireland": "ChIJj4MfVq-JYEgR5UdeZUQhGWk",
  "portugal": "ChIJ1SZCvy0kMgsRQfBOHAlLuB0",
  "poland": "ChIJuwtkpGSZAEcR6lXMScpzdQk",
  // North America
  "united states": "ChIJCzYy5IS16lQRQrfeQ5K5Oxw",
  "usa": "ChIJCzYy5IS16lQRQrfeQ5K5Oxw",
  "us": "ChIJCzYy5IS16lQRQrfeQ5K5Oxw",
  "canada": "ChIJ2WrMN9MDDUsRpY9Dll18Wo4",
  "mexico": "ChIJU1NoiDs6BIQREZgJa760ZO0",
  // Other
  "australia": "ChIJ38WHZwf9KysRUhNblaFnglM",
  "brazil": "ChIJzyjM68dCnAAR_gKgVYIhKQM",
  "india": "ChIJkbeSa_BfYzARphNChaFPjNc",
  "japan": "ChIJLxl_1w9OZzQRRFJmfNR1QvU",
  "singapore": "ChIJdZOLiiMR2jERxPWrUs9peIg",
  "israel": "ChIJi8mnMiRJABURuiw1EyBCa2o",
  "uae": "ChIJvRKrsd9IXj4RpwoIwFYv0zM",
  "south africa": "ChIJGbV4-al-lR4RNIuFKk6RcOc",
};

/**
 * Resolves human-readable location names to Instantly-compatible
 * {place_id, label} objects using a built-in lookup table.
 * Returns null for locations that cannot be resolved (caller should skip them).
 */
export function resolveLocation(name: string): { place_id: string; label: string } | null {
  const key = name.toLowerCase().trim();
  const placeId = LOCATION_PLACE_IDS[key];
  if (!placeId) return null;
  return { place_id: placeId, label: name };
}

// ─── Response Types ──────────────────────────────────────

export interface InstantlyLead {
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  title?: string;
  linkedin_url?: string;
  phone?: string;
  website?: string;
  country?: string;
  company_size?: string;
  industry?: string;
}

export interface InstantlyCampaign {
  id: string;
  name: string;
  status?: string;
}

export interface InstantlyAccount {
  email: string;
  first_name?: string;
  last_name?: string;
  status?: string;
}

// ─── HTTP Helper with Retry ──────────────────────────────

async function instantlyFetch<T>(
  apiKey: string,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${BASE_URL}${path}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });

    if (res.ok) {
      return (await res.json()) as T;
    }

    // Retry on 429 or 5xx
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    const errorBody = await res.text().catch(() => "");
    throw new Error(
      `[Instantly] ${method} ${path} failed (${res.status}): ${errorBody}`,
    );
  }

  throw new Error(`[Instantly] ${method} ${path} failed after ${MAX_RETRIES} retries`);
}

// ─── Filter Preparation ─────────────────────────────────
// Resolves string locations to place_id objects before sending to Instantly API.

function prepareFiltersForAPI(filters: InstantlySearchFilters): Record<string, unknown> {
  const prepared = { ...filters } as Record<string, unknown>;

  if (filters.locations && Array.isArray(filters.locations)) {
    const first = filters.locations[0];
    if (typeof first === "string") {
      // Resolve string location names to place_id objects
      const resolved: Array<{ place_id: string; label: string }> = [];
      const unresolved: string[] = [];

      for (const loc of filters.locations as string[]) {
        const obj = resolveLocation(loc);
        if (obj) {
          resolved.push(obj);
        } else {
          unresolved.push(loc);
        }
      }

      if (unresolved.length > 0) {
        console.warn(`[Instantly] Could not resolve locations: ${unresolved.join(", ")}. Skipped.`);
      }

      if (resolved.length > 0) {
        prepared.locations = resolved;
      } else {
        delete prepared.locations;
      }
    }
  }

  return prepared;
}

// ─── SuperSearch ─────────────────────────────────────────

export async function countLeads(
  apiKey: string,
  searchFilters: InstantlySearchFilters,
): Promise<{ count: number }> {
  return instantlyFetch(apiKey, "POST", "/supersearch-enrichment/count-leads-from-supersearch", {
    search_filters: prepareFiltersForAPI(searchFilters),
  });
}

export async function previewLeads(
  apiKey: string,
  searchFilters: InstantlySearchFilters,
): Promise<InstantlyLead[]> {
  const res = await instantlyFetch<{ items?: InstantlyLead[]; leads?: InstantlyLead[] }>(
    apiKey,
    "POST",
    "/supersearch-enrichment/preview-leads-from-supersearch",
    { search_filters: prepareFiltersForAPI(searchFilters) },
  );
  return res.items ?? res.leads ?? [];
}

export async function searchLeads(
  apiKey: string,
  params: {
    searchFilters: InstantlySearchFilters;
    limit?: number;
    startingAfter?: string;
  },
): Promise<{ items: InstantlyLead[]; nextStartingAfter?: string }> {
  return instantlyFetch(apiKey, "POST", "/lead-lists/search", {
    search_filters: prepareFiltersForAPI(params.searchFilters),
    limit: params.limit ?? 100,
    starting_after: params.startingAfter,
  });
}

export interface EnrichmentPayload {
  work_email_enrichment?: boolean;
  fully_enriched_profile?: boolean;
  email_verification?: boolean;
  joblisting?: boolean;
  technologies?: boolean;
  news?: boolean;
  funding?: boolean;
  ai_enrichment?: boolean;
  custom_flow?: boolean;
}

const DEFAULT_ENRICHMENT_PAYLOAD: EnrichmentPayload = {
  work_email_enrichment: true,
};

export async function sourceLeads(
  apiKey: string,
  params: {
    searchFilters: InstantlySearchFilters;
    limit: number;
    searchName: string;
    listName: string;
    enrichmentPayload?: EnrichmentPayload;
  },
): Promise<{ id: string; resourceId: string }> {
  return instantlyFetch(apiKey, "POST", "/supersearch-enrichment/enrich-leads-from-supersearch", {
    search_filters: prepareFiltersForAPI(params.searchFilters),
    limit: params.limit,
    search_name: params.searchName,
    list_name: params.listName,
    enrichment_payload: params.enrichmentPayload ?? DEFAULT_ENRICHMENT_PAYLOAD,
  });
}

export async function getEnrichmentStatus(
  apiKey: string,
  resourceId: string,
): Promise<{ inProgress: boolean; exists: boolean; enrichmentPayload?: unknown }> {
  return instantlyFetch(apiKey, "GET", `/supersearch-enrichment/${resourceId}`);
}

// ─── Leads ───────────────────────────────────────────────

export async function listLeads(
  apiKey: string,
  params: {
    listId?: string;
    campaignId?: string;
    limit?: number;
    startingAfter?: string;
  },
): Promise<{ items: InstantlyLead[]; nextStartingAfter?: string }> {
  return instantlyFetch(apiKey, "POST", "/leads/list", {
    list_id: params.listId,
    campaign_id: params.campaignId,
    limit: params.limit ?? 100,
    starting_after: params.startingAfter,
  });
}

export async function createLead(
  apiKey: string,
  params: {
    email: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    campaign?: string;
    customVariables?: Record<string, string>;
  },
): Promise<InstantlyLead> {
  return instantlyFetch(apiKey, "POST", "/leads", {
    email: params.email,
    first_name: params.firstName,
    last_name: params.lastName,
    company_name: params.companyName,
    campaign: params.campaign,
    custom_variables: params.customVariables,
  });
}

// ─── Campaigns ───────────────────────────────────────────

export async function createCampaign(
  apiKey: string,
  params: {
    name: string;
    sequences: Array<{ steps: Array<{ subject?: string; body: string; type?: string }> }>;
    dailyLimit?: number;
    emailList?: string[];
  },
): Promise<InstantlyCampaign> {
  return instantlyFetch(apiKey, "POST", "/campaigns", {
    name: params.name,
    sequences: params.sequences,
    daily_limit: params.dailyLimit,
    email_list: params.emailList,
  });
}

export async function activateCampaign(
  apiKey: string,
  campaignId: string,
): Promise<void> {
  await instantlyFetch(apiKey, "POST", `/campaigns/${campaignId}/activate`);
}

export async function listCampaigns(
  apiKey: string,
): Promise<InstantlyCampaign[]> {
  const res = await instantlyFetch<{ items?: InstantlyCampaign[] } | InstantlyCampaign[]>(
    apiKey,
    "GET",
    "/campaigns",
  );
  return Array.isArray(res) ? res : res.items ?? [];
}

// ─── Accounts ────────────────────────────────────────────

export async function listAccounts(
  apiKey: string,
): Promise<InstantlyAccount[]> {
  const res = await instantlyFetch<{ items?: InstantlyAccount[] } | InstantlyAccount[]>(
    apiKey,
    "GET",
    "/accounts",
  );
  return Array.isArray(res) ? res : res.items ?? [];
}

// ─── Client Factory ──────────────────────────────────────

/**
 * Retrieves the encrypted Instantly API key for a workspace,
 * decrypts it, and returns a bound client object.
 */
export async function getInstantlyClient(workspaceId: string) {
  const integration = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId, type: "INSTANTLY" } },
  });

  if (!integration?.apiKey) {
    throw new Error("[Instantly] No API key found. Connect Instantly in Settings.");
  }

  if (integration.status !== "ACTIVE") {
    throw new Error("[Instantly] Integration is not active. Reconnect in Settings.");
  }

  const apiKey = decrypt(integration.apiKey);

  return {
    countLeads: (filters: InstantlySearchFilters) => countLeads(apiKey, filters),
    previewLeads: (filters: InstantlySearchFilters) => previewLeads(apiKey, filters),
    sourceLeads: (params: Parameters<typeof sourceLeads>[1]) => sourceLeads(apiKey, params),
    searchLeads: (params: Parameters<typeof searchLeads>[1]) => searchLeads(apiKey, params),
    getEnrichmentStatus: (resourceId: string) => getEnrichmentStatus(apiKey, resourceId),
    listLeads: (params: Parameters<typeof listLeads>[1]) => listLeads(apiKey, params),
    createLead: (params: Parameters<typeof createLead>[1]) => createLead(apiKey, params),
    createCampaign: (params: Parameters<typeof createCampaign>[1]) => createCampaign(apiKey, params),
    activateCampaign: (campaignId: string) => activateCampaign(apiKey, campaignId),
    listCampaigns: () => listCampaigns(apiKey),
    listAccounts: () => listAccounts(apiKey),
  };
}
