import type { EnrichmentData } from "@/server/lib/enrichment/summarizer";

/** Lead data required for email drafting */
export interface LeadForEmail {
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  industry?: string | null;
  companySize?: string | null;
  country?: string | null;
  enrichmentData?: EnrichmentData | null;
}

/** Reference to a previously drafted email (used for follow-up coherence) */
export interface DraftedEmailRef {
  step: number;
  subject: string;
  body?: string;
}
