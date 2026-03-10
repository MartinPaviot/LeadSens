/**
 * Apollo Connector — People & Company enrichment via Apollo.io API.
 *
 * Endpoints used:
 * - POST /v1/people/match — Enrich a person by email/domain/name
 * - POST /v1/organizations/enrich — Enrich a company by domain
 * - GET /v1/auth/health — Test API key validity
 *
 * API docs: https://apolloio.github.io/apollo-api-docs/
 */

import { z } from "zod/v4";

const APOLLO_BASE = "https://api.apollo.io";

// ─── Types ──────────────────────────────────────────────

export interface ApolloPersonResult {
  email?: string;
  emailStatus?: string; // "verified" | "guessed" | "unavailable"
  firstName?: string;
  lastName?: string;
  title?: string;
  headline?: string;
  linkedinUrl?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  organizationName?: string;
  organizationDomain?: string;
  organizationIndustry?: string;
  organizationEmployeeCount?: string;
  organizationRevenue?: string;
  seniority?: string;
  departments?: string[];
}

export interface ApolloOrganizationResult {
  name?: string;
  domain?: string;
  industry?: string;
  employeeCount?: number;
  estimatedRevenue?: string;
  shortDescription?: string;
  city?: string;
  state?: string;
  country?: string;
  linkedinUrl?: string;
  technologies?: string[];
  keywords?: string[];
  fundingTotal?: number;
  latestFundingRoundDate?: string;
}

// ─── Zod schemas for API response validation ────────────

const apolloPersonSchema = z.object({
  person: z.object({
    email: z.string().nullish(),
    email_status: z.string().nullish(),
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    title: z.string().nullish(),
    headline: z.string().nullish(),
    linkedin_url: z.string().nullish(),
    phone_numbers: z.array(z.object({ raw_number: z.string().nullish() })).nullish(),
    city: z.string().nullish(),
    state: z.string().nullish(),
    country: z.string().nullish(),
    seniority: z.string().nullish(),
    departments: z.array(z.string()).nullish(),
    organization: z.object({
      name: z.string().nullish(),
      primary_domain: z.string().nullish(),
      industry: z.string().nullish(),
      estimated_num_employees: z.number().nullish(),
      annual_revenue_printed: z.string().nullish(),
    }).nullish(),
  }).nullish(),
});

const apolloOrgSchema = z.object({
  organization: z.object({
    name: z.string().nullish(),
    primary_domain: z.string().nullish(),
    industry: z.string().nullish(),
    estimated_num_employees: z.number().nullish(),
    annual_revenue_printed: z.string().nullish(),
    short_description: z.string().nullish(),
    city: z.string().nullish(),
    state: z.string().nullish(),
    country: z.string().nullish(),
    linkedin_url: z.string().nullish(),
    current_technologies: z.array(z.object({ name: z.string().nullish() })).nullish(),
    keywords: z.array(z.string()).nullish(),
    total_funding: z.number().nullish(),
    latest_funding_round_date: z.string().nullish(),
  }).nullish(),
});

// ─── API Helpers ────────────────────────────────────────

async function apolloFetch(
  apiKey: string,
  path: string,
  method: "GET" | "POST" = "POST",
  body?: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${APOLLO_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apollo API ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

// ─── Public API ─────────────────────────────────────────

/**
 * Test Apollo API key validity.
 */
export async function testApolloConnection(apiKey: string): Promise<boolean> {
  try {
    // Apollo doesn't have a dedicated health endpoint.
    // A lightweight people/match with no data will return 200 if the key is valid.
    const res = await fetch(`${APOLLO_BASE}/v1/auth/health`, {
      method: "GET",
      headers: { "X-Api-Key": apiKey },
    });
    // Some Apollo plans may not expose /auth/health — fallback to a people search
    if (res.ok) return true;

    // Fallback: try a minimal search to validate the key
    const fallbackRes = await fetch(`${APOLLO_BASE}/v1/people/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({ page: 1, per_page: 1 }),
    });
    return fallbackRes.ok;
  } catch {
    return false;
  }
}

/**
 * Enrich a person by email and/or domain + name.
 * Returns null if the person is not found.
 */
export async function enrichPerson(
  apiKey: string,
  params: {
    email?: string;
    firstName?: string;
    lastName?: string;
    domain?: string;
    linkedinUrl?: string;
  },
): Promise<ApolloPersonResult | null> {
  try {
    const body: Record<string, unknown> = {};
    if (params.email) body.email = params.email;
    if (params.firstName) body.first_name = params.firstName;
    if (params.lastName) body.last_name = params.lastName;
    if (params.domain) body.domain = params.domain;
    if (params.linkedinUrl) body.linkedin_url = params.linkedinUrl;

    const raw = await apolloFetch(apiKey, "/v1/people/match", "POST", body);
    const parsed = apolloPersonSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.person) return null;

    const p = parsed.data.person;
    const org = p.organization;

    return {
      email: p.email ?? undefined,
      emailStatus: p.email_status ?? undefined,
      firstName: p.first_name ?? undefined,
      lastName: p.last_name ?? undefined,
      title: p.title ?? undefined,
      headline: p.headline ?? undefined,
      linkedinUrl: p.linkedin_url ?? undefined,
      phone: p.phone_numbers?.[0]?.raw_number ?? undefined,
      city: p.city ?? undefined,
      state: p.state ?? undefined,
      country: p.country ?? undefined,
      seniority: p.seniority ?? undefined,
      departments: p.departments ?? undefined,
      organizationName: org?.name ?? undefined,
      organizationDomain: org?.primary_domain ?? undefined,
      organizationIndustry: org?.industry ?? undefined,
      organizationEmployeeCount: org?.estimated_num_employees?.toString() ?? undefined,
      organizationRevenue: org?.annual_revenue_printed ?? undefined,
    };
  } catch (err) {
    console.warn("[apollo] Person enrichment failed:", err);
    return null;
  }
}

/**
 * Enrich a company/organization by domain.
 * Returns null if the organization is not found.
 */
export async function enrichOrganization(
  apiKey: string,
  domain: string,
): Promise<ApolloOrganizationResult | null> {
  try {
    // Apollo expects domain as query param for org enrich
    const res = await fetch(
      `${APOLLO_BASE}/v1/organizations/enrich?domain=${encodeURIComponent(domain)}`,
      {
        method: "GET",
        headers: { "X-Api-Key": apiKey },
      },
    );
    if (!res.ok) return null;

    const json = await res.json();
    const parsed = apolloOrgSchema.safeParse(json);
    if (!parsed.success || !parsed.data.organization) return null;

    const o = parsed.data.organization;

    return {
      name: o.name ?? undefined,
      domain: o.primary_domain ?? undefined,
      industry: o.industry ?? undefined,
      employeeCount: o.estimated_num_employees ?? undefined,
      estimatedRevenue: o.annual_revenue_printed ?? undefined,
      shortDescription: o.short_description ?? undefined,
      city: o.city ?? undefined,
      state: o.state ?? undefined,
      country: o.country ?? undefined,
      linkedinUrl: o.linkedin_url ?? undefined,
      technologies: o.current_technologies?.map((t) => t.name).filter(Boolean) as string[] ?? undefined,
      keywords: o.keywords ?? undefined,
      fundingTotal: o.total_funding ?? undefined,
      latestFundingRoundDate: o.latest_funding_round_date ?? undefined,
    };
  } catch (err) {
    console.warn("[apollo] Organization enrichment failed:", err);
    return null;
  }
}
