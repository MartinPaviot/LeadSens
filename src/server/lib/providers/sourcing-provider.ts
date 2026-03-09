/**
 * SourcingProvider — Abstraction for lead sourcing platforms.
 *
 * Implementations: Instantly (SuperSearch), Apollo
 * Each provider maps from normalized filters to their API-specific format.
 */

// ─── Common Types ────────────────────────────────────────

export interface NormalizedSearchFilters {
  // Person
  jobTitles?: string[];
  departments?: string[];
  seniorityLevels?: string[];
  excludeNames?: string[];

  // Company
  industries?: string[];
  subIndustries?: string[];
  employeeCount?: string[];
  revenue?: string[];
  companyNames?: { include?: string[]; exclude?: string[] };
  domains?: string[];

  // Location
  locations?: string[];
  locationFilterType?: "contact" | "company_hq";

  // Advanced
  keywords?: string;
  technologies?: string[];
  fundingTypes?: string[];
  signals?: string[];

  // Raw provider-specific filters (passthrough)
  _raw?: Record<string, unknown>;
}

export interface PreviewLead {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  linkedinUrl?: string;
  email?: string;
}

export interface SourceLeadsParams {
  filters: NormalizedSearchFilters | Record<string, unknown>;
  limit: number;
  listName: string;
  searchName?: string;
}

export interface SourceLeadsResult {
  leads: SourcedLead[];
  listId?: string;
  resourceId?: string;
  totalFromApi: number;
}

export interface SourcedLead {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  jobTitle?: string;
  linkedinUrl?: string;
  phone?: string;
  website?: string;
  country?: string;
  companySize?: string;
  industry?: string;
  companyDomain?: string;
}

// ─── Interface ───────────────────────────────────────────

export interface SourcingProvider {
  readonly name: "instantly" | "apollo";

  /** Count available leads matching filters */
  countLeads(filters: NormalizedSearchFilters | Record<string, unknown>): Promise<number>;

  /** Preview a sample of leads (no credits consumed) */
  previewLeads(
    filters: NormalizedSearchFilters | Record<string, unknown>,
    limit?: number,
  ): Promise<PreviewLead[]>;

  /** Source leads into a list (consumes credits) */
  sourceLeads(params: SourceLeadsParams): Promise<SourceLeadsResult>;

  /** Poll enrichment/sourcing status (if async) */
  getStatus?(resourceId: string): Promise<{ status: string; progress?: number }>;
}
