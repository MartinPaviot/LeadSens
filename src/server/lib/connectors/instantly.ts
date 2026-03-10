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
    "Executive", "Manager", "Senior",
    "Chief X Officer (CxO)", "Internship",
    "Vice President (VP)", "Unpaid / Internship", "Partner",
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
  sub_industries: z.array(z.string()).optional(),
  employee_count: z.array(z.enum([
    "0 - 25", "25 - 100", "100 - 250", "250 - 1000",
    "1K - 10K", "10K - 50K", "50K - 100K", "> 100K",
  ])).optional(),
  revenue: z.array(z.enum([
    "$0 - 1M", "$1M - 10M", "$10M - 50M", "$50M - 100M",
    "$100M - 250M", "$250M - 500M", "$500M - 1B", "> $1B",
  ])).optional(),
  funding_type: z.array(z.enum([
    "angel", "seed", "pre_seed",
    "series_a", "series_b", "series_c", "series_d",
    "series_e", "series_f", "series_g", "series_h", "series_i", "series_j",
    "pre_series_a", "pre_series_b", "pre_series_c", "pre_series_d",
    "pre_series_e", "pre_series_f", "pre_series_g", "pre_series_h", "pre_series_i", "pre_series_j",
    "convertible_note", "corporate_round", "debt_financing",
    "equity_crowdfunding", "grant", "initial_coin_offering",
    "non_equity_assistance", "post_ipo_debt", "post_ipo_equity",
    "post_ipo_secondary", "private_equity", "product_crowdfunding",
    "secondary_market", "undisclosed",
  ])).optional(),
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
  news: z.array(z.enum([
    "has_had_recent_funding", "has_had_recent_acquisition_or_merger",
    "has_had_recent_job_change", "has_had_recent_technology_change",
    "has_had_recent_leadership_change", "has_had_recent_layoffs",
    "has_upcoming_contract_renewal", "has_had_recent_new_partnerships",
    "has_had_recent_award", "has_had_product_launch",
    "has_had_recent_expansion", "has_had_recent_earnings_report",
    "has_had_recent_data_breach_security_event", "has_had_recent_regulatory_change",
    "has_had_recent_customer_win_or_significant_deal",
    "has_filed_recent_patent", "has_had_recent_cost_cutting",
    "has_had_recent_rebranding", "has_had_ipo",
    "has_entered_new_market_or_geography", "has_had_recent_restructuring",
    "has_had_recent_sustainability_csr_initiative",
    "has_had_recent_legal_issue_or_controversy",
    "has_had_recent_management_change",
    "has_active_job_listings", "has_had_ieo",
    "has_had_recent_investment", "has_had_recent_dividend_announcement",
  ])).optional(),
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
  // ── European countries ──
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
  // ── European cities ──
  "paris": "ChIJD7fiBh9u5kcRYJSMaMOCCwQ",
  "london": "ChIJdd4hrwug2EcRmSrV3Vo6llI",
  "berlin": "ChIJAVkDPzdOqEcRcDteW0YgIQQ",
  "madrid": "ChIJgTwKgJcpQg0RaSKMYcHeNtQ",
  "barcelona": "ChIJ5TCOcRaYpBIRCmZHTz37sEQ",
  "amsterdam": "ChIJVXealLU_xkcRja_At0z9AGY",
  "milan": "ChIJ53USP0nBhkcRjQ50xhPN_zw",
  "rome": "ChIJu46S-ZZhLxMROG5lkwZ3D7k",
  "munich": "ChIJ2V-Mo_l1nkcRfZixfUq4DAE",
  "dublin": "ChIJL6wn6oAOZ0gRoB1jVRBbNBo",
  "lisbon": "ChIJO_PkYRozGQ0R0DaQ3CdqC68",
  "vienna": "ChIJn8o2UZ4HbUcRRluiUei_gSs",
  "stockholm": "ChIJywtkGTF2X0YRZnGgz3jBAAo",
  "copenhagen": "ChIJIz2AXDxTUkYRuGeU5t1-3QQ",
  "oslo": "ChIJOfBn8mFuQUYRmh4j019gkn4",
  "helsinki": "ChIJ3fYyS9_KgUYREKh1PNZGAQA",
  "zurich": "ChIJGaK-SZcLkEcR_IYBiIMRjqo",
  "brussels": "ChIJhYWMmo7Ew0cRMF31bDU3tTg",
  "warsaw": "ChIJAYWNPkdZzDkR4KLERnHGzuQ",
  "prague": "ChIJi3lwCZyTC0cRkEAWZg-vAAQ",
  "budapest": "ChIJyc_U0TTDQUcRYBEeDCnEAAQ",
  // ── North American countries ──
  "united states": "ChIJCzYy5IS16lQRQrfeQ5K5Oxw",
  "usa": "ChIJCzYy5IS16lQRQrfeQ5K5Oxw",
  "us": "ChIJCzYy5IS16lQRQrfeQ5K5Oxw",
  "canada": "ChIJ2WrMN9MDDUsRpY9Dll18Wo4",
  "mexico": "ChIJU1NoiDs6BIQREZgJa760ZO0",
  // ── North American cities ──
  "new york": "ChIJOwg_06VPwokRYv534QaPC8g",
  "san francisco": "ChIJIQBpAG2ahYAR_6128GcTUEo",
  "los angeles": "ChIJE9on3F3HwoAR9AhGJW_fL-I",
  "chicago": "ChIJ7cv00DwsDogRAMDACa2m4K8",
  "toronto": "ChIJpTvG15DL1IkRd8S0KlBVNTI",
  "montreal": "ChIJDbdkHFQayUwR7-8fITgxTmU",
  "vancouver": "ChIJs0-pQ_FzhlQRi_OBm-qWkbs",
  // ── Other countries ──
  "australia": "ChIJ38WHZwf9KysRUhNblaFnglM",
  "brazil": "ChIJzyjM68dCnAAR_gKgVYIhKQM",
  "india": "ChIJkbeSa_BfYzARphNChaFPjNc",
  "japan": "ChIJLxl_1w9OZzQRRFJmfNR1QvU",
  "singapore": "ChIJdZOLiiMR2jERxPWrUs9peIg",
  "israel": "ChIJi8mnMiRJABURuiw1EyBCa2o",
  "uae": "ChIJvRKrsd9IXj4RpwoIwFYv0zM",
  "south africa": "ChIJGbV4-al-lR4RNIuFKk6RcOc",
  // ── Other cities ──
  "sydney": "ChIJP3Sa8ziYEmsRUKgyFmh9AQM",
  "tokyo": "ChIJ51cu8IcbYWARhRyRKS_zBBg",
  "dubai": "ChIJRcbZaklDXz4RYlEphFBu5r0",
  "tel aviv": "ChIJH3w7GaZMHRURkD-WwKJy8eE",
  "sao paulo": "ChIJ0WGkg4FEzpQRrlsz_whLqZs",
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

/** Lead as returned by SuperSearch preview (camelCase, no email) */
export interface InstantlyPreviewLead {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  jobTitle?: string;
  location?: string;
  linkedIn?: string;
  companyName?: string;
  companyLogo?: string;
  companyId?: string;
}

/** Lead as returned by POST /leads/list (snake_case top-level + camelCase payload) */
export interface InstantlyLead {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  phone?: string | null;
  website?: string | null;
  personalization?: string | null;
  company_domain?: string;
  status?: number;
  campaign?: string | null;
  list_id?: string | null;
  verification_status?: number;
  esp_code?: number;
  lt_interest_status?: number;
  email_open_count?: number;
  email_reply_count?: number;
  email_click_count?: number;
  timestamp_last_open?: string;
  timestamp_last_reply?: string;
  /** Custom variables & SuperSearch data (camelCase keys) */
  payload?: Record<string, unknown> | null;
  timestamp_created?: string;
  timestamp_updated?: string;
}

/** Lead with mapped performance/engagement fields */
export interface LeadWithPerformance {
  id: string;
  email: string;
  openCount: number;
  replyCount: number;
  clickCount: number;
  interestStatus: number | null;
  lastOpenAt: string | null;
  lastReplyAt: string | null;
}

/** Normalized lead for internal use (consistent field names) */
export interface NormalizedLead {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  linkedinUrl?: string | null;
  phone?: string | null;
  website?: string | null;
  location?: string | null;
  companyDomain?: string | null;
}

export interface InstantlyCampaign {
  id: string;
  name: string;
  status: number; // 0=Draft, 1=Active, 2=Paused, 3=Completed, -1=Error
  campaign_schedule?: CampaignSchedule;
  sequences?: Array<{
    steps: Array<{
      type: string;
      delay: number;
      delay_unit?: string;
      pre_delay_unit?: string;
      variants: Array<{ subject: string; body: string }>;
    }>;
  }>;
  timestamp_created?: string;
  timestamp_updated?: string;
  organization?: string;
}

export interface InstantlyAccount {
  email: string;
  first_name?: string;
  last_name?: string;
  status: number; // 1=Active
  warmup_status: number; // 0=Disabled, 1=Enabled, 2=Max daily limit
  provider_code: number; // 1=Google, 2=Microsoft
  stat_warmup_score?: number;
  setup_pending?: boolean;
  is_managed_account?: boolean;
  timestamp_created?: string;
}

// ─── HTTP Helper with Retry ──────────────────────────────

async function instantlyFetch<T>(
  apiKey: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
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

// ─── Level → Title fallback ─────────────────────────────
// The `level` filter in Instantly SuperSearch is NON-FUNCTIONAL:
// - "VP-Level", "C-Level", "Staff" → always return 0 results
// - "Director", "Manager", "Owner" → return 1M (same as no filter = ignored)
// When the ICP parser outputs `level` without `job_titles`, we auto-generate
// title search terms from the level + department combination.

const LEVEL_TITLE_MAP: Record<string, Record<string, string[]>> = {
  "C-Level": {
    Sales: ["Chief Revenue Officer", "CRO"],
    Engineering: ["CTO", "Chief Technology Officer", "Chief Technical Officer"],
    Marketing: ["CMO", "Chief Marketing Officer"],
    "Finance & Administration": ["CFO", "Chief Financial Officer"],
    "Human Resources": ["CHRO", "Chief Human Resources Officer", "Chief People Officer"],
    "IT & IS": ["CIO", "Chief Information Officer"],
    Operations: ["COO", "Chief Operating Officer"],
    _default: ["CEO", "CTO", "CFO", "COO", "CMO", "CRO", "CIO", "CHRO"],
  },
  "VP-Level": {
    Sales: ["VP Sales", "VP of Sales", "Vice President Sales"],
    Engineering: ["VP Engineering", "VP of Engineering", "Vice President Engineering"],
    Marketing: ["VP Marketing", "VP of Marketing", "Vice President Marketing"],
    "Finance & Administration": ["VP Finance", "VP of Finance"],
    "Human Resources": ["VP HR", "VP Human Resources", "VP People"],
    "IT & IS": ["VP IT", "VP Information Technology"],
    Operations: ["VP Operations", "VP Ops"],
    Support: ["VP Customer Success", "VP Support"],
    _default: ["VP", "Vice President"],
  },
  "Director-Level": {
    Sales: ["Sales Director", "Director of Sales", "Head of Sales"],
    Engineering: ["Engineering Director", "Director of Engineering", "Head of Engineering"],
    Marketing: ["Marketing Director", "Director of Marketing", "Head of Marketing"],
    "Finance & Administration": ["Finance Director", "Director of Finance"],
    "Human Resources": ["HR Director", "Director of HR", "Head of HR"],
    "IT & IS": ["IT Director", "Director of IT"],
    Operations: ["Director of Operations", "Head of Operations"],
    Support: ["Director of Customer Success", "Head of Support"],
    _default: ["Director", "Head of"],
  },
  "Manager-Level": {
    Sales: ["Sales Manager"],
    Engineering: ["Engineering Manager"],
    Marketing: ["Marketing Manager"],
    "Finance & Administration": ["Finance Manager"],
    "Human Resources": ["HR Manager"],
    "IT & IS": ["IT Manager"],
    Operations: ["Operations Manager"],
    Support: ["Customer Success Manager", "Support Manager"],
    _default: ["Manager"],
  },
  Owner: {
    _default: ["Founder", "Co-Founder", "Owner", "CEO"],
  },
};

/**
 * Generates job title search terms from level + department when the
 * ICP parser only returned department+level (legacy Strategy A).
 */
function levelToTitles(levels: string[], departments?: string[]): string[] {
  const titles = new Set<string>();
  for (const level of levels) {
    const levelMap = LEVEL_TITLE_MAP[level];
    if (!levelMap) continue;

    if (departments?.length) {
      for (const dept of departments) {
        const deptTitles = levelMap[dept] ?? levelMap._default ?? [];
        deptTitles.forEach((t) => titles.add(t));
      }
    } else {
      const defaults = levelMap._default ?? [];
      defaults.forEach((t) => titles.add(t));
    }
  }
  return [...titles];
}

// ─── Filter Preparation ─────────────────────────────────
// Transforms internal filter schema → Instantly API v2 expected format.
// Field name and format differences:
//   job_titles: string[]       → title: { include: string[] }
//   industries: string[]       → industry: { include: string[] }
//   sub_industries: string[]   → subIndustry: { include: string[] }
//   employee_count: string[]   → employeeCount: string[]
//   keyword_filter: string     → keyword_filter: { include: string }
//   company_names: {...}       → company_name: {...}
//   names: {include, exclude}  → name: string[]
//   lookalike_domain: string   → look_alike: string
//   location_filter_type       → location_mode
//   revenue values             → mapped via REVENUE_TO_API
//   level: NEVER sent to API   → converted to title via LEVEL_TITLE_MAP

export interface PreparedFilters {
  api: Record<string, unknown>;
  warnings: string[];
}

function prepareFiltersForAPI(filters: InstantlySearchFilters): PreparedFilters {
  const api: Record<string, unknown> = {};
  const warnings: string[] = [];

  // ── Person filters ──

  // level → NEVER send to API (broken: returns 0 or 1M depending on value).
  // If level is set without job_titles, auto-generate title from level+department.
  let effectiveJobTitles = filters.job_titles;
  if (filters.level?.length && !effectiveJobTitles?.length) {
    const generated = levelToTitles(filters.level, filters.department);
    if (generated.length > 0) {
      effectiveJobTitles = generated;
      console.log(`[prepareFiltersForAPI] Converted level ${JSON.stringify(filters.level)} → title ${JSON.stringify(generated)}`);
    }
  }

  // job_titles → title: { include: [...] }
  if (effectiveJobTitles?.length) {
    api.title = { include: effectiveJobTitles };
  }

  // department — pass through (correct Title Case enum values)
  if (filters.department?.length) {
    api.department = filters.department;
  }

  // level — NEVER sent to API (see above)

  // names → name (API expects plain string[])
  if (filters.names?.include?.length) {
    api.name = filters.names.include;
  }

  // ── Company filters ──

  // industries → industry: { include: [...] }
  if (filters.industries?.length) {
    api.industry = { include: filters.industries };
  }

  // sub_industries → subIndustry: { include: [...] } (official API field name: camelCase, singular)
  if (filters.sub_industries?.length) {
    api.subIndustry = { include: filters.sub_industries };
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
        warnings.push(`Location filter ignored — could not resolve: ${unresolved.join(", ")}. Leads will NOT be filtered by location.`);
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
  if (filters.news?.length) {
    api.news = filters.news;
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
  if (warnings.length > 0) console.warn("[prepareFiltersForAPI] Warnings:", warnings);
  return { api, warnings };
}

// ─── SuperSearch ─────────────────────────────────────────

export async function countLeads(
  apiKey: string,
  searchFilters: InstantlySearchFilters,
): Promise<{ count: number; warnings: string[] }> {
  const { api, warnings } = prepareFiltersForAPI(searchFilters);
  const res = await instantlyFetch<Record<string, unknown>>(apiKey, "POST", "/supersearch-enrichment/count-leads-from-supersearch", {
    search_filters: api,
  });

  console.log("[countLeads] Raw API response:", JSON.stringify(res).slice(0, 500));

  // The API may return { count }, { total_count }, { total }, or a nested structure
  const count = (res.number_of_leads ?? res.count ?? res.total_count ?? res.total ?? 0) as number;
  return { count, warnings };
}

export async function previewLeads(
  apiKey: string,
  searchFilters: InstantlySearchFilters,
): Promise<{ leads: InstantlyPreviewLead[]; warnings: string[] }> {
  const { api, warnings } = prepareFiltersForAPI(searchFilters);
  const res = await instantlyFetch<{
    number_of_leads?: number;
    number_of_redacted_results?: number;
    leads?: InstantlyPreviewLead[];
  }>(
    apiKey,
    "POST",
    "/supersearch-enrichment/preview-leads-from-supersearch",
    { search_filters: api },
  );

  return { leads: res.leads ?? [], warnings };
}

/** Normalize a preview lead (camelCase) to our internal format */
export function normalizePreviewLead(lead: InstantlyPreviewLead): NormalizedLead {
  return {
    email: "", // Preview never includes email
    firstName: lead.firstName ?? null,
    lastName: lead.lastName ?? null,
    company: lead.companyName ?? null,
    jobTitle: lead.jobTitle ?? null,
    linkedinUrl: lead.linkedIn
      ? lead.linkedIn.startsWith("http") ? lead.linkedIn : `https://${lead.linkedIn}`
      : null,
    phone: null,
    website: null,
    location: lead.location ?? null,
    companyDomain: null,
  };
}

/** Normalize a stored lead (snake_case + payload) to our internal format */
export function normalizeStoredLead(lead: InstantlyLead): NormalizedLead {
  const p = lead.payload ?? {};
  return {
    email: lead.email,
    firstName: lead.first_name ?? (p.firstName as string) ?? null,
    lastName: lead.last_name ?? (p.lastName as string) ?? null,
    company: lead.company_name ?? (p.companyName as string) ?? null,
    jobTitle: (p.jobTitle as string) ?? null,
    linkedinUrl: (p.linkedIn as string)
      ? (p.linkedIn as string).startsWith("http") ? (p.linkedIn as string) : `https://${p.linkedIn as string}`
      : null,
    phone: lead.phone ?? null,
    website: lead.website ?? (p.companyDomain as string) ?? null,
    location: (p.location as string) ?? null,
    companyDomain: lead.company_domain ?? (p.companyDomain as string) ?? null,
  };
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
): Promise<{ id: string; resourceId: string; warnings: string[] }> {
  const enrichment = params.enrichment ?? DEFAULT_ENRICHMENT;
  const { api, warnings } = prepareFiltersForAPI(params.searchFilters);

  // Enrichment options are TOP-LEVEL body params per Instantly API v2 docs,
  // NOT nested inside an enrichment_payload object.
  const res = await instantlyFetch<Record<string, unknown>>(apiKey, "POST", "/supersearch-enrichment/enrich-leads-from-supersearch", {
    search_filters: api,
    limit: params.limit,
    search_name: params.searchName,
    list_name: params.listName,
    ...enrichment,
  });
  // API returns resource_id (snake_case), normalize to camelCase
  return {
    id: (res.id ?? "") as string,
    resourceId: (res.resource_id ?? res.resourceId ?? "") as string,
    warnings,
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
  const res = await instantlyFetch<{ items: InstantlyLead[]; next_starting_after?: string }>(
    apiKey, "POST", "/leads/list", {
      list_id: params.listId,
      campaign_id: params.campaignId,
      limit: params.limit ?? 100,
      starting_after: params.startingAfter,
    },
  );
  return { items: res.items, nextStartingAfter: res.next_starting_after };
}

export async function getLead(
  apiKey: string,
  leadId: string,
): Promise<InstantlyLead> {
  return instantlyFetch(apiKey, "GET", `/leads/${leadId}`);
}

export async function createLead(
  apiKey: string,
  params: {
    email: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    campaign?: string;
    listId?: string;
    customVariables?: Record<string, string>;
  },
): Promise<InstantlyLead> {
  return instantlyFetch(apiKey, "POST", "/leads", {
    email: params.email,
    first_name: params.firstName,
    last_name: params.lastName,
    company_name: params.companyName,
    campaign: params.campaign,
    list_id: params.listId,
    custom_variables: params.customVariables,
  });
}

export async function updateLead(
  apiKey: string,
  leadId: string,
  data: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
    phone?: string;
    website?: string;
    customVariables?: Record<string, string>;
    ltInterestStatus?: number;
  },
): Promise<InstantlyLead> {
  return instantlyFetch(apiKey, "PATCH", `/leads/${leadId}`, {
    first_name: data.firstName,
    last_name: data.lastName,
    company_name: data.companyName,
    phone: data.phone,
    website: data.website,
    custom_variables: data.customVariables,
    lt_interest_status: data.ltInterestStatus,
  });
}

export async function deleteLead(
  apiKey: string,
  leadId: string,
): Promise<void> {
  await instantlyFetch<unknown>(apiKey, "DELETE", `/leads/${leadId}`);
}

export async function deleteLeadsBulk(
  apiKey: string,
  params: { leadIds?: string[]; campaignId?: string; listId?: string },
): Promise<void> {
  await instantlyFetch<unknown>(apiKey, "DELETE", "/leads", {
    lead_ids: params.leadIds,
    campaign_id: params.campaignId,
    list_id: params.listId,
  });
}

export async function addLeadsToCampaign(
  apiKey: string,
  params: {
    leadIds: string[];
    campaignId: string;
  },
): Promise<void> {
  await instantlyFetch(apiKey, "POST", "/leads/add", {
    lead_ids: params.leadIds,
    campaign_id: params.campaignId,
  });
}

export async function moveLeads(
  apiKey: string,
  params: {
    leadIds: string[];
    fromCampaignId: string;
    toCampaignId: string;
  },
): Promise<void> {
  await instantlyFetch(apiKey, "POST", "/leads/move", {
    lead_ids: params.leadIds,
    from_campaign_id: params.fromCampaignId,
    to_campaign_id: params.toCampaignId,
  });
}

export async function updateLeadInterestStatus(
  apiKey: string,
  params: { leadId: string; interestStatus: number },
): Promise<void> {
  await instantlyFetch(apiKey, "POST", "/leads/update-interest-status", {
    lead_id: params.leadId,
    interest_status: params.interestStatus,
  });
}

// ─── Campaigns ───────────────────────────────────────────

export interface CampaignStep {
  subject?: string;
  subjects?: string[];
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
      timezone: "Europe/Sarajevo", // CET/CEST — same as Paris (Europe/Paris not in Instantly enum)
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
      steps: params.steps.map((s, i) => {
        // Build variants: if multiple subjects provided, create one variant per subject
        const subjects = s.subjects?.length ? s.subjects : [s.subject ?? ""];
        const variants = subjects.map((subj) => ({ subject: subj, body: s.body }));

        return {
          type: "email" as const,
          delay: s.delay ?? (i === 0 ? 0 : 3),
          delay_unit: "days" as const,
          pre_delay_unit: "days" as const,
          variants,
        };
      }),
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

export async function getCampaign(
  apiKey: string,
  campaignId: string,
): Promise<InstantlyCampaign> {
  return instantlyFetch(apiKey, "GET", `/campaigns/${campaignId}`);
}

export async function updateCampaign(
  apiKey: string,
  campaignId: string,
  data: Partial<{
    name: string;
    campaign_schedule: CampaignSchedule;
    daily_limit: number;
    email_list: string[];
  }>,
): Promise<InstantlyCampaign> {
  return instantlyFetch(apiKey, "PATCH", `/campaigns/${campaignId}`, data);
}

export async function deleteCampaign(
  apiKey: string,
  campaignId: string,
): Promise<void> {
  await instantlyFetch<unknown>(apiKey, "DELETE", `/campaigns/${campaignId}`);
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
  const all: InstantlyCampaign[] = [];
  let startingAfter: string | undefined;

  do {
    const query = new URLSearchParams({ limit: "100" });
    if (startingAfter) query.set("starting_after", startingAfter);

    const res = await instantlyFetch<{
      items: InstantlyCampaign[];
      next_starting_after?: string;
    }>(apiKey, "GET", `/campaigns?${query.toString()}`);

    all.push(...(res.items ?? []));
    startingAfter = res.next_starting_after;
  } while (startingAfter);

  return all;
}

// ─── Campaign Monitoring ─────────────────────────────────

export interface InstantlySendingStatus {
  campaign_id: string;
  in_progress: number;
  not_yet_contacted: number;
  completed: number;
  leads_in_campaign: number;
}

export interface InstantlyCampaignAnalytics {
  campaign_id: string;
  campaign_name?: string;
  total_leads: number;
  contacted: number;
  emails_sent: number;
  emails_read: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
  new_leads_contacted: number;
  total_opportunities: number;
}

export interface InstantlyEmail {
  id: string;
  timestamp_created: string;
  from_address: string;
  to_address: string;
  subject: string;
  content_preview?: string;
  body?: { html?: string; text?: string };
  ue_type: number; // 1=sent_campaign, 2=received(reply), 3=sent_manual
  thread_id?: string;
  campaign_id?: string;
  is_unread?: number; // 0 or 1
  is_auto_reply?: number; // 0 or 1
  ai_interest_value?: number | null;
  i_status?: string;
  lead?: string; // lead email address (API field name)
  lead_email?: string; // alias — some endpoints use this
}

export async function getCampaignSendingStatus(
  apiKey: string,
  campaignId: string,
): Promise<InstantlySendingStatus> {
  return instantlyFetch<InstantlySendingStatus>(
    apiKey,
    "GET",
    `/campaigns/${campaignId}/sending-status`,
  );
}

export async function pauseCampaign(
  apiKey: string,
  campaignId: string,
): Promise<void> {
  await instantlyFetch(apiKey, "POST", `/campaigns/${campaignId}/pause`);
}

export async function getCampaignAnalytics(
  apiKey: string,
  campaignId: string,
): Promise<InstantlyCampaignAnalytics> {
  const query = new URLSearchParams({ campaign_id: campaignId });
  const items = await instantlyFetch<InstantlyCampaignAnalytics[]>(
    apiKey,
    "GET",
    `/campaigns/analytics?${query.toString()}`,
  );
  // API returns array; return the first matching campaign or throw
  const match = Array.isArray(items) ? items[0] : items;
  if (!match) throw new Error(`[Instantly] No analytics found for campaign ${campaignId}`);
  return match;
}

export interface CampaignStepAnalytics {
  step: number;
  sent: number;
  opened: number;
  replied: number;
  bounced: number;
}

export async function getCampaignStepAnalytics(
  apiKey: string,
  campaignId: string,
): Promise<{ steps: CampaignStepAnalytics[] }> {
  const query = new URLSearchParams({ campaign_id: campaignId });
  const res = await instantlyFetch<Record<string, unknown>>(
    apiKey,
    "GET",
    `/campaigns/analytics/steps?${query.toString()}`,
  );

  // Handle both { steps: [...] } and raw [...] shapes
  const rawSteps: unknown[] = Array.isArray(res) ? res : (Array.isArray(res.steps) ? res.steps : []);

  const steps: CampaignStepAnalytics[] = rawSteps.map((s: unknown) => {
    const item = s as Record<string, unknown>;
    return {
      step: (item.step ?? item.step_number ?? 0) as number,
      sent: (item.sent ?? item.emails_sent ?? 0) as number,
      opened: (item.opened ?? item.emails_read ?? item.emails_opened ?? 0) as number,
      replied: (item.replied ?? item.replies ?? 0) as number,
      bounced: (item.bounced ?? item.bounces ?? 0) as number,
    };
  });

  return { steps };
}

export async function getLeadsWithPerformance(
  apiKey: string,
  campaignId: string,
  limit?: number,
  startingAfter?: string,
): Promise<{ items: LeadWithPerformance[]; nextStartingAfter?: string }> {
  const { items, nextStartingAfter } = await listLeads(apiKey, {
    campaignId,
    limit: limit ?? 100,
    startingAfter,
  });

  const mapped: LeadWithPerformance[] = items.map((lead) => ({
    id: lead.id,
    email: lead.email,
    openCount: lead.email_open_count ?? 0,
    replyCount: lead.email_reply_count ?? 0,
    clickCount: lead.email_click_count ?? 0,
    interestStatus: lead.lt_interest_status ?? null,
    lastOpenAt: lead.timestamp_last_open ?? null,
    lastReplyAt: lead.timestamp_last_reply ?? null,
  }));

  return { items: mapped, nextStartingAfter };
}

export async function getEmails(
  apiKey: string,
  params: {
    campaign_id?: string;
    email_type?: string;
    is_unread?: boolean;
    lead?: string;
    limit?: number;
    starting_after?: string;
  },
): Promise<{ items: InstantlyEmail[]; next_starting_after?: string }> {
  const query = new URLSearchParams();
  if (params.campaign_id) query.set("campaign_id", params.campaign_id);
  if (params.email_type) query.set("email_type", params.email_type);
  if (params.is_unread !== undefined) query.set("is_unread", params.is_unread ? "1" : "0");
  if (params.lead) query.set("lead", params.lead);
  if (params.starting_after) query.set("starting_after", params.starting_after);
  query.set("limit", String(params.limit ?? 25));

  return instantlyFetch<{ items: InstantlyEmail[]; next_starting_after?: string }>(
    apiKey,
    "GET",
    `/emails?${query.toString()}`,
  );
}

// ─── Accounts ────────────────────────────────────────────

export async function listAccounts(
  apiKey: string,
): Promise<InstantlyAccount[]> {
  const all: InstantlyAccount[] = [];
  let startingAfter: string | undefined;

  do {
    const query = new URLSearchParams({ limit: "100" });
    if (startingAfter) query.set("starting_after", startingAfter);

    const res = await instantlyFetch<{
      items: InstantlyAccount[];
      next_starting_after?: string;
    }>(apiKey, "GET", `/accounts?${query.toString()}`);

    all.push(...(res.items ?? []));
    startingAfter = res.next_starting_after;
  } while (startingAfter);

  return all;
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
    // SuperSearch
    countLeads: (filters: InstantlySearchFilters) => countLeads(apiKey, filters),
    previewLeads: (filters: InstantlySearchFilters) => previewLeads(apiKey, filters),
    sourceLeads: (params: Parameters<typeof sourceLeads>[1]) => sourceLeads(apiKey, params),
    getEnrichmentStatus: (resourceId: string) => getEnrichmentStatus(apiKey, resourceId),
    // Leads
    listLeads: (params: Parameters<typeof listLeads>[1]) => listLeads(apiKey, params),
    getLead: (leadId: string) => getLead(apiKey, leadId),
    createLead: (params: Parameters<typeof createLead>[1]) => createLead(apiKey, params),
    updateLead: (leadId: string, data: Parameters<typeof updateLead>[2]) => updateLead(apiKey, leadId, data),
    deleteLead: (leadId: string) => deleteLead(apiKey, leadId),
    deleteLeadsBulk: (params: Parameters<typeof deleteLeadsBulk>[1]) => deleteLeadsBulk(apiKey, params),
    addLeadsToCampaign: (params: Parameters<typeof addLeadsToCampaign>[1]) => addLeadsToCampaign(apiKey, params),
    moveLeads: (params: Parameters<typeof moveLeads>[1]) => moveLeads(apiKey, params),
    updateLeadInterestStatus: (params: Parameters<typeof updateLeadInterestStatus>[1]) => updateLeadInterestStatus(apiKey, params),
    // Campaigns
    createCampaign: (params: Parameters<typeof createCampaign>[1]) => createCampaign(apiKey, params),
    getCampaign: (campaignId: string) => getCampaign(apiKey, campaignId),
    updateCampaign: (campaignId: string, data: Parameters<typeof updateCampaign>[2]) => updateCampaign(apiKey, campaignId, data),
    deleteCampaign: (campaignId: string) => deleteCampaign(apiKey, campaignId),
    activateCampaign: (campaignId: string) => activateCampaign(apiKey, campaignId),
    listCampaigns: () => listCampaigns(apiKey),
    // Campaign Monitoring
    getCampaignSendingStatus: (campaignId: string) => getCampaignSendingStatus(apiKey, campaignId),
    pauseCampaign: (campaignId: string) => pauseCampaign(apiKey, campaignId),
    getCampaignAnalytics: (campaignId: string) => getCampaignAnalytics(apiKey, campaignId),
    getCampaignStepAnalytics: (campaignId: string) => getCampaignStepAnalytics(apiKey, campaignId),
    getEmails: (params: Parameters<typeof getEmails>[1]) => getEmails(apiKey, params),
    getLeadsWithPerformance: (campaignId: string, limit?: number, startingAfter?: string) => getLeadsWithPerformance(apiKey, campaignId, limit, startingAfter),
    // Accounts
    listAccounts: () => listAccounts(apiKey),
  };
}
