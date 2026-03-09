/**
 * Instantly Sourcing Provider — wraps the raw Instantly connector
 * to implement the SourcingProvider interface.
 */

import * as instantly from "./instantly";
import type {
  SourcingProvider,
  PreviewLead,
  SourceLeadsParams,
  SourceLeadsResult,
} from "@/server/lib/providers/sourcing-provider";

export function createInstantlySourcing(apiKey: string): SourcingProvider {
  return {
    name: "instantly",

    async countLeads(filters: Record<string, unknown>): Promise<number> {
      // Cast to any — the SourcingProvider interface accepts generic filters,
      // and instantly.countLeads validates internally
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await instantly.countLeads(apiKey, filters as any);
      return result.count;
    },

    async previewLeads(filters: Record<string, unknown>, limit?: number): Promise<PreviewLead[]> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { leads } = await instantly.previewLeads(apiKey, filters as any);
      const normalized = leads.map(instantly.normalizePreviewLead);
      return normalized.slice(0, limit ?? 30).map((l) => ({
        firstName: l.firstName ?? undefined,
        lastName: l.lastName ?? undefined,
        jobTitle: l.jobTitle ?? undefined,
        company: l.company ?? undefined,
        linkedinUrl: l.linkedinUrl ?? undefined,
        email: l.email ?? undefined,
      }));
    },

    async sourceLeads(params: SourceLeadsParams): Promise<SourceLeadsResult> {
      const result = await instantly.sourceLeads(apiKey, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        searchFilters: params.filters as any,
        limit: params.limit,
        searchName: params.searchName ?? params.listName,
        listName: params.listName,
        enrichment: { work_email_enrichment: true },
      });

      // Poll until complete
      let inProgress = true;
      while (inProgress) {
        await new Promise((r) => setTimeout(r, 3000));
        const status = await instantly.getEnrichmentStatus(apiKey, result.resourceId);
        inProgress = status.inProgress;
      }

      // Fetch all sourced leads
      const allLeads: Awaited<ReturnType<typeof instantly.listLeads>>["items"] = [];
      let cursor: string | undefined;
      do {
        const page = await instantly.listLeads(apiKey, {
          listId: result.resourceId,
          limit: 100,
          startingAfter: cursor,
        });
        allLeads.push(...page.items);
        cursor = page.nextStartingAfter;
      } while (cursor);

      return {
        leads: allLeads.map((l) => {
          const n = instantly.normalizeStoredLead(l);
          return {
            email: n.email,
            firstName: n.firstName ?? undefined,
            lastName: n.lastName ?? undefined,
            company: n.company ?? undefined,
            jobTitle: n.jobTitle ?? undefined,
            linkedinUrl: n.linkedinUrl ?? undefined,
            phone: n.phone ?? undefined,
            website: n.website ?? undefined,
            country: n.location ?? undefined,
            companyDomain: n.companyDomain ?? undefined,
          };
        }),
        listId: result.resourceId,
        resourceId: result.resourceId,
        totalFromApi: allLeads.length,
      };
    },

    async getStatus(resourceId: string) {
      const status = await instantly.getEnrichmentStatus(apiKey, resourceId);
      return {
        status: status.inProgress ? "in_progress" : "complete",
      };
    },
  };
}
