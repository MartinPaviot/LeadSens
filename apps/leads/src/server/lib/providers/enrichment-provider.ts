/**
 * EnrichmentProvider — Abstraction for data enrichment services.
 *
 * Future implementations: Clearbit, Lusha, RocketReach, etc.
 */

export interface EnrichmentResult {
  email: string;
  data: Record<string, unknown>;
  confidence?: number;
}

export interface EnrichmentProvider {
  readonly name: string;

  /** Enrich a single contact by email */
  enrichSingle(email: string): Promise<EnrichmentResult>;

  /** Enrich a batch of contacts */
  enrichBatch(emails: string[]): Promise<EnrichmentResult[]>;

  /** Get remaining credits (if applicable) */
  getCredits?(): Promise<number>;
}
