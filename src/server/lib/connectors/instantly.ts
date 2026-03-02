import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

const BASE_URL = "https://api.instantly.ai/api/v2";
const MAX_RETRIES = 3;

// ─── Search Filters Schema ───────────────────────────────
// Aligned with Instantly API v2 (docs/INSTANTLY-API.md)

// Location object — Instantly requires Google Maps place_id
const locationObjectSchema = z.object({
  place_id: z.string(),
  label: z.string().optional(),
});

export const searchFiltersSchema = z.object({
  // ── Person filters ──
  job_titles: z.array(z.string()).optional(),
  level: z.array(z.enum([
    "C-Level", "VP-Level", "Director-Level", "Manager-Level",
    "Staff", "Entry level", "Mid-Senior level", "Director",
    "Associate", "Owner",
  ])).optional(),
  department: z.array(z.enum([
    "Engineering", "Finance & Administration", "Human Resources",
    "IT & IS", "Marketing", "Operations", "Sales", "Support", "Other",
  ])).optional(),
  names: z.object({
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
  }).optional(),

  // ── Company filters ──
  industries: z.array(z.enum([
    "Agriculture & Mining", "Business Services", "Computers & Electronics",
    "Consumer Services", "Education", "Energy & Utilities",
    "Financial Services", "Government",
    "Healthcare, Pharmaceuticals, & Biotech", "Manufacturing",
    "Media & Entertainment", "Non-Profit", "Other",
    "Real Estate & Construction", "Retail", "Software & Internet",
    "Telecommunications", "Transportation & Storage",
    "Travel, Recreation, and Leisure", "Wholesale & Distribution",
  ])).optional(),
  employee_count: z.array(z.enum([
    "0 - 25", "25 - 100", "100 - 250", "250 - 1000",
    "1K - 10K", "10K - 50K", "50K - 100K", "> 100K",
  ])).optional(),
  revenue: z.array(z.enum([
    "$0 - 1M", "$1M - 10M", "$10M - 50M", "$50M - 100M",
    "$100M - 250M", "$250M - 500M", "$500M - 1B", "> $1B",
  ])).optional(),
  funding_type: z.array(z.string()).optional(),
  company_names: z.object({
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
  }).optional(),
  domains: z.array(z.string()).optional(),

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
  location_filter_type: z.enum(["contact", "company_hq"]).optional(),

  // ── Advanced filters ──
  keyword_filter: z.string().optional(),              // Plain string
  technologies: z.array(z.string()).optional(),
  lookalike_domain: z.string().optional(),
  news: z.string().optional(),                        // Plain string
  job_listing: z.string().optional(),

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

// ─── Revenue Mapping ─────────────────────────────────────
// Internal values use "$1M - 10M" format, but API expects "$1 - 10M" (no M on first number)
const REVENUE_TO_API: Record<string, string> = {
  "$1M - 10M": "$1 - 10M",
  "$10M - 50M": "$10 - 50M",
  "$50M - 100M": "$50 - 100M",
  "$100M - 250M": "$100 - 250M",
  "$250M - 500M": "$250 - 500M",
};
function mapRevenueToAPI(v: string): string {
  return REVENUE_TO_API[v] ?? v;
}

// ─── Filter Preparation ─────────────────────────────────
// Transforms internal filter schema → Instantly API v2 expected format.
// Field name and format differences:
//   job_titles: string[]       → title: { include: string[] }
//   industries: string[]       → industry: { include: string[] }
//   employee_count: string[]   → employeeCount: string[]
//   keyword_filter: string     → keyword_filter: { include: string }
//   company_names: {...}       → company_name: {...}
//   names: {include, exclude}  → name: string[]
//   lookalike_domain: string   → look_alike: string
//   location_filter_type       → location_mode
//   revenue values             → mapped via REVENUE_TO_API

function prepareFiltersForAPI(filters: InstantlySearchFilters): Record<string, unknown> {
  const api: Record<string, unknown> = {};

  // ── Person filters ──

  // job_titles → title: { include: [...] }
  if (filters.job_titles?.length) {
    api.title = { include: filters.job_titles };
  }

  // department — pass through (correct Title Case enum values)
  if (filters.department?.length) {
    api.department = filters.department;
  }

  // level — pass through (correct enum values like "VP-Level", "C-Level")
  if (filters.level?.length) {
    api.level = filters.level;
  }

  // names → name (API expects plain string[])
  if (filters.names?.include?.length) {
    api.name = filters.names.include;
  }

  // ── Company filters ──

  // industries → industry: { include: [...] }
  if (filters.industries?.length) {
    api.industry = { include: filters.industries };
  }

  // employee_count → employeeCount (camelCase)
  if (filters.employee_count?.length) {
    api.employeeCount = filters.employee_count;
  }

  // revenue — map internal values to API format
  if (filters.revenue?.length) {
    api.revenue = filters.revenue.map(mapRevenueToAPI);
  }

  // funding_type — pass through
  if (filters.funding_type?.length) {
    api.funding_type = filters.funding_type;
  }

  // company_names → company_name
  if (filters.company_names) {
    api.company_name = filters.company_names;
  }

  // domains — pass through
  if (filters.domains?.length) {
    api.domains = filters.domains;
  }

  // ── Location filters ──

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
        api.locations = resolved;
      }
    } else {
      // Already place_id objects — pass through
      api.locations = filters.locations;
    }
  } else if (filters.locations && !Array.isArray(filters.locations)) {
    // Object format with include/exclude — pass through
    api.locations = filters.locations;
  }

  // location_filter_type → location_mode ("company_hq" → "company")
  if (filters.location_filter_type) {
    api.location_mode = filters.location_filter_type === "company_hq"
      ? "company" : filters.location_filter_type;
  }

  // ── Advanced filters ──

  // keyword_filter → keyword_filter: { include: string }
  if (filters.keyword_filter) {
    api.keyword_filter = { include: filters.keyword_filter };
  }

  // technologies — pass through
  if (filters.technologies?.length) {
    api.technologies = filters.technologies;
  }

  // lookalike_domain → look_alike
  if (filters.lookalike_domain) {
    api.look_alike = filters.lookalike_domain;
  }

  // news — API expects string[] enum
  if (filters.news) {
    api.news = Array.isArray(filters.news) ? filters.news : [filters.news];
  }

  // job_listing — pass through
  if (filters.job_listing) {
    api.job_listing = filters.job_listing;
  }

  // ── Dedup options ──

  if (filters.skip_owned_leads !== undefined) {
    api.skip_owned_leads = filters.skip_owned_leads;
  }
  if (filters.show_one_lead_per_company !== undefined) {
    api.show_one_lead_per_company = filters.show_one_lead_per_company;
  }

  console.log("[prepareFiltersForAPI] Sending to Instantly:", JSON.stringify(api).slice(0, 1000));
  return api;
}

// ─── SuperSearch ─────────────────────────────────────────

export async function countLeads(
  apiKey: string,
  searchFilters: InstantlySearchFilters,
): Promise<{ count: number }> {
  const res = await instantlyFetch<Record<string, unknown>>(apiKey, "POST", "/supersearch-enrichment/count-leads-from-supersearch", {
    search_filters: prepareFiltersForAPI(searchFilters),
  });

  console.log("[countLeads] Raw API response:", JSON.stringify(res).slice(0, 500));

  // The API may return { count }, { total_count }, { total }, or a nested structure
  const count = (res.number_of_leads ?? res.count ?? res.total_count ?? res.total ?? 0) as number;
  return { count };
}

export async function previewLeads(
  apiKey: string,
  searchFilters: InstantlySearchFilters,
): Promise<InstantlyLead[]> {
  const res = await instantlyFetch<Record<string, unknown>>(
    apiKey,
    "POST",
    "/supersearch-enrichment/preview-leads-from-supersearch",
    { search_filters: prepareFiltersForAPI(searchFilters) },
  );

  // Debug: log raw response keys and first item to diagnose field mapping
  console.log("[previewLeads] Response keys:", Object.keys(res));
  const items = (res.items ?? res.leads ?? []) as InstantlyLead[];
  if (items.length > 0) {
    console.log("[previewLeads] Total items:", items.length);
    console.log("[previewLeads] First item keys:", Object.keys(items[0]));
    console.log("[previewLeads] First item:", JSON.stringify(items[0]).slice(0, 500));
  } else {
    console.log("[previewLeads] No items returned. Full response keys:", Object.keys(res), "Checking nested structures...");
    // Try to find leads in nested structures
    for (const key of Object.keys(res)) {
      const val = res[key];
      if (Array.isArray(val) && val.length > 0) {
        console.log(`[previewLeads] Found array at key "${key}" with ${val.length} items. First:`, JSON.stringify(val[0]).slice(0, 300));
      }
    }
  }

  return items;
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

export interface EnrichmentOptions {
  work_email_enrichment?: boolean;
  fully_enriched_profile?: boolean;
  custom_flow?: string[];
  skip_rows_without_email?: boolean;
}

const DEFAULT_ENRICHMENT: EnrichmentOptions = {
  work_email_enrichment: true,
};

export async function sourceLeads(
  apiKey: string,
  params: {
    searchFilters: InstantlySearchFilters;
    limit: number;
    searchName: string;
    listName: string;
    enrichment?: EnrichmentOptions;
  },
): Promise<{ id: string; resourceId: string }> {
  const enrichment = params.enrichment ?? DEFAULT_ENRICHMENT;

  // Enrichment options are TOP-LEVEL body params per Instantly API v2 docs,
  // NOT nested inside an enrichment_payload object.
  const res = await instantlyFetch<Record<string, unknown>>(apiKey, "POST", "/supersearch-enrichment/enrich-leads-from-supersearch", {
    search_filters: prepareFiltersForAPI(params.searchFilters),
    limit: params.limit,
    search_name: params.searchName,
    list_name: params.listName,
    ...enrichment,
  });
  // API returns resource_id (snake_case), normalize to camelCase
  return {
    id: (res.id ?? "") as string,
    resourceId: (res.resource_id ?? res.resourceId ?? "") as string,
  };
}

export async function getEnrichmentStatus(
  apiKey: string,
  resourceId: string,
): Promise<{ inProgress: boolean; exists: boolean; enrichmentPayload?: unknown }> {
  const res = await instantlyFetch<Record<string, unknown>>(apiKey, "GET", `/supersearch-enrichment/${resourceId}`);
  // API returns snake_case (in_progress), normalize to camelCase
  return {
    inProgress: (res.in_progress ?? res.inProgress ?? false) as boolean,
    exists: (res.exists ?? false) as boolean,
    enrichmentPayload: res.enrichment_payload ?? res.enrichmentPayload,
  };
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

export interface CampaignStep {
  subject?: string;
  body: string;
  delay?: number;
}

export interface CampaignSchedule {
  schedules: Array<{
    name: string;
    timing: { from: string; to: string };
    days: Record<string, boolean>;
    timezone: string;
  }>;
  start_date?: string | null;
  end_date?: string | null;
}

const DEFAULT_CAMPAIGN_SCHEDULE: CampaignSchedule = {
  schedules: [
    {
      name: "Business Hours",
      timing: { from: "09:00", to: "17:00" },
      days: { "0": false, "1": true, "2": true, "3": true, "4": true, "5": true, "6": false },
      timezone: "Europe/Paris",
    },
  ],
  start_date: null,
  end_date: null,
};

export async function createCampaign(
  apiKey: string,
  params: {
    name: string;
    steps: CampaignStep[];
    dailyLimit?: number;
    emailList?: string[];
    campaignSchedule?: CampaignSchedule;
  },
): Promise<InstantlyCampaign> {
  const sequences = [
    {
      steps: params.steps.map((s, i) => ({
        type: "email" as const,
        delay: s.delay ?? (i === 0 ? 0 : 3),
        variants: [{ subject: s.subject ?? "", body: s.body }],
      })),
    },
  ];

  return instantlyFetch(apiKey, "POST", "/campaigns", {
    name: params.name,
    campaign_schedule: params.campaignSchedule ?? DEFAULT_CAMPAIGN_SCHEDULE,
    sequences,
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
