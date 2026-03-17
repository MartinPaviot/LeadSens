/**
 * Apollo Composio Connector — People & Company enrichment via Composio-managed Apollo.
 *
 * Replaces direct HTTP calls in apollo.ts with Composio action execution.
 * Apollo is NOT a standard provider — it exports standalone functions
 * used by the enrichment pipeline (same interface as apollo.ts).
 *
 * Composio actions used:
 * - APOLLO_GET_AUTH_STATUS        — test connection
 * - APOLLO_PEOPLE_ENRICHMENT      — enrich a person by email/domain/name
 * - APOLLO_ORGANIZATION_ENRICHMENT — enrich org by domain
 * - APOLLO_PEOPLE_SEARCH          — search people by titles/locations/domains
 * - APOLLO_VIEW_API_USAGE_STATS   — get API usage
 */

import { executeAction } from "@/server/lib/composio/execute";
import { logger } from "@/lib/logger";
import type {
  ApolloPersonResult,
  ApolloOrganizationResult,
} from "@/server/lib/connectors/apollo";

// ─── Composio Response Types ─────────────────────────────

/** Raw person object from APOLLO_PEOPLE_ENRICHMENT response */
interface ApolloRawPerson {
  email?: string | null;
  email_status?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  headline?: string | null;
  linkedin_url?: string | null;
  phone_numbers?: Array<{ raw_number?: string | null }> | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  seniority?: string | null;
  departments?: string[] | null;
  organization?: {
    name?: string | null;
    primary_domain?: string | null;
    industry?: string | null;
    estimated_num_employees?: number | null;
    annual_revenue_printed?: string | null;
  } | null;
}

/** Raw organization object from APOLLO_ORGANIZATION_ENRICHMENT response */
interface ApolloRawOrganization {
  name?: string | null;
  primary_domain?: string | null;
  industry?: string | null;
  estimated_num_employees?: number | null;
  annual_revenue_printed?: string | null;
  short_description?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  linkedin_url?: string | null;
  keywords?: string[] | null;
  technologies?: Array<{ name?: string | null }> | string[] | null;
  total_funding_printed?: string | null;
  latest_funding_round_date?: string | null;
}

/** Raw search person from APOLLO_PEOPLE_SEARCH response */
interface ApolloRawSearchPerson {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  title?: string | null;
  headline?: string | null;
  linkedin_url?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  seniority?: string | null;
  departments?: string[] | null;
  organization?: {
    name?: string | null;
    primary_domain?: string | null;
    industry?: string | null;
    estimated_num_employees?: number | null;
  } | null;
}

// ─── Mappers ─────────────────────────────────────────────

function mapRawPerson(p: ApolloRawPerson): ApolloPersonResult {
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
    organizationEmployeeCount:
      org?.estimated_num_employees?.toString() ?? undefined,
    organizationRevenue: org?.annual_revenue_printed ?? undefined,
  };
}

function mapRawOrganization(o: ApolloRawOrganization): ApolloOrganizationResult {
  // Technologies can come as objects with name or plain strings
  let technologies: string[] | undefined;
  if (Array.isArray(o.technologies) && o.technologies.length > 0) {
    technologies = o.technologies
      .map((t) => (typeof t === "string" ? t : t?.name))
      .filter((name): name is string => typeof name === "string" && name.length > 0);
  }

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
    technologies,
    keywords: o.keywords ?? undefined,
    fundingTotal: undefined, // Composio returns printed string, not number
    latestFundingRoundDate: o.latest_funding_round_date ?? undefined,
  };
}

// ─── Public API ──────────────────────────────────────────

/**
 * Test Apollo connection via Composio.
 * Uses APOLLO_GET_AUTH_STATUS to verify the workspace has a valid Apollo connection.
 */
export async function testApolloComposioConnection(
  workspaceId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await executeAction<{ authenticated?: boolean }>(
      "APOLLO_GET_AUTH_STATUS",
      workspaceId,
      {},
    );
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("[apollo-composio] Connection test failed", {
      workspaceId,
      error: message,
    });
    return { ok: false, error: message };
  }
}

/**
 * Enrich a person by email and/or domain + name via Composio.
 * Returns null if the person is not found or enrichment fails.
 */
export async function enrichPersonComposio(
  workspaceId: string,
  params: {
    email?: string;
    firstName?: string;
    lastName?: string;
    domain?: string;
    organizationName?: string;
  },
): Promise<ApolloPersonResult | null> {
  try {
    const args: Record<string, unknown> = {};
    if (params.email) args.email = params.email;
    if (params.firstName) args.first_name = params.firstName;
    if (params.lastName) args.last_name = params.lastName;
    if (params.domain) args.domain = params.domain;
    if (params.organizationName) args.organization_name = params.organizationName;

    const result = await executeAction<{ person?: ApolloRawPerson }>(
      "APOLLO_PEOPLE_ENRICHMENT",
      workspaceId,
      args,
    );

    if (!result?.person) return null;
    return mapRawPerson(result.person);
  } catch (err) {
    logger.warn("[apollo-composio] Person enrichment failed", {
      workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Enrich a company/organization by domain via Composio.
 * Returns null if the organization is not found or enrichment fails.
 */
export async function enrichOrganizationComposio(
  workspaceId: string,
  domain: string,
): Promise<ApolloOrganizationResult | null> {
  try {
    const result = await executeAction<{ organization?: ApolloRawOrganization }>(
      "APOLLO_ORGANIZATION_ENRICHMENT",
      workspaceId,
      { domain },
    );

    if (!result?.organization) return null;
    return mapRawOrganization(result.organization);
  } catch (err) {
    logger.warn("[apollo-composio] Organization enrichment failed", {
      workspaceId,
      domain,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Search for people using Apollo's contact database via Composio.
 * Returns an empty array if the search fails or returns no results.
 *
 * Note: Does NOT return emails/phones — use enrichPersonComposio() for that.
 */
export async function searchPeopleComposio(
  workspaceId: string,
  params: {
    titles?: string[];
    locations?: string[];
    domains?: string[];
    perPage?: number;
    page?: number;
  },
): Promise<ApolloPersonResult[]> {
  try {
    const args: Record<string, unknown> = {};
    if (params.titles?.length) args.person_titles = params.titles;
    if (params.locations?.length) args.person_locations = params.locations;
    if (params.domains?.length) args.q_organization_domains = params.domains;
    args.per_page = params.perPage ?? 25;
    args.page = params.page ?? 1;

    const result = await executeAction<{
      people?: ApolloRawSearchPerson[];
      contacts?: ApolloRawSearchPerson[];
    }>(
      "APOLLO_PEOPLE_SEARCH",
      workspaceId,
      args,
    );

    // Apollo search may return results under "people" or "contacts"
    const people = result?.people ?? result?.contacts ?? [];
    if (!Array.isArray(people)) return [];

    return people.map((p): ApolloPersonResult => ({
      email: undefined, // Search does not return emails
      firstName: p.first_name ?? undefined,
      lastName: p.last_name ?? undefined,
      title: p.title ?? undefined,
      headline: p.headline ?? undefined,
      linkedinUrl: p.linkedin_url ?? undefined,
      city: p.city ?? undefined,
      state: p.state ?? undefined,
      country: p.country ?? undefined,
      seniority: p.seniority ?? undefined,
      departments: p.departments ?? undefined,
      organizationName: p.organization?.name ?? undefined,
      organizationDomain: p.organization?.primary_domain ?? undefined,
      organizationIndustry: p.organization?.industry ?? undefined,
      organizationEmployeeCount:
        p.organization?.estimated_num_employees?.toString() ?? undefined,
    }));
  } catch (err) {
    logger.warn("[apollo-composio] People search failed", {
      workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Get Apollo API usage stats via Composio.
 * Returns null on failure (graceful degradation).
 */
export async function getApiUsageComposio(
  workspaceId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const result = await executeAction<Record<string, unknown>>(
      "APOLLO_VIEW_API_USAGE_STATS",
      workspaceId,
      {},
    );
    return result ?? null;
  } catch {
    return null;
  }
}
