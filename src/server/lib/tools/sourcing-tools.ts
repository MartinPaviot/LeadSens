/**
 * Sourcing Tools — Instantly SuperSearch sourcing (Instantly-only).
 *
 * Tools: parse_icp, count_leads, preview_leads, source_leads
 *
 * These tools use the raw Instantly client directly because SuperSearch
 * is an Instantly-specific feature. ESP-generic tools are in esp-tools.ts.
 */

import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getInstantlyClient, normalizePreviewLead, normalizeStoredLead } from "@/server/lib/connectors/instantly";
import { parseICPv2, buildFilterSummary } from "./icp-parser";
import { logger } from "@/lib/logger";
import type { ToolDefinition, ToolContext } from "./types";

// Lightweight schema for tool parameters — Mistral only needs to know
// "pass the search_filters object from parse_icp". The full searchFiltersSchema
// validation happens inside parse_icp, not at the tool-call level.
const searchFiltersParam = z
  .record(z.string(), z.unknown())
  .describe("The search_filters object returned by parse_icp. Pass as-is, do not modify.");

export function createSourcingTools(ctx: ToolContext): Record<string, ToolDefinition> {
  return {
    parse_icp: {
      name: "parse_icp",
      description: "Parse a natural language ICP description into Instantly SuperSearch filters. ALWAYS call this FIRST before count_leads/preview_leads/source_leads. Handles all mapping (industry, employee ranges, locations, job titles) automatically. Returns { search_filters } to pass directly to the other tools.",
      parameters: z.object({
        description: z.string().describe("The user's ICP description in natural language"),
      }),
      async execute(args) {
        const { filters, inferredIndustries, parseWarnings, approximations, clarificationNeeded } = await parseICPv2(args.description, ctx.workspaceId);

        // Description too vague — ask the user to clarify before proceeding
        if (clarificationNeeded) {
          return {
            status: "clarification_needed",
            message: clarificationNeeded,
          };
        }

        const result: Record<string, unknown> = {
          search_filters: filters,
          human_summary: buildFilterSummary(filters),
        };
        if (inferredIndustries?.length) {
          result.confirmation_needed = `J'ai déduit l'industrie « ${inferredIndustries.join(", ")} » de ta description car elle n'était pas explicitement spécifiée. Confirme que c'est correct ou précise l'industrie souhaitée avant de continuer.`;
        }
        if (parseWarnings?.length) {
          result.filter_warnings = parseWarnings;
        }
        if (approximations?.length) {
          result.filter_approximations = approximations;
        }
        return result;
      },
    },

    count_leads: {
      name: "count_leads",
      description: "Estimate the number of leads available for given search filters. Automatically broadens filters if count is 0. Returns { count, search_filters }. Do NOT call this tool again after getting a result — use the returned search_filters directly for preview/source.",
      parameters: z.object({ search_filters: searchFiltersParam }),
      async execute(args) {
        const client = await getInstantlyClient(ctx.workspaceId);

        // First attempt
        let result: { count: number; warnings: string[] };

        logger.debug("[count_leads] Filters:", { filters: JSON.stringify(args.search_filters).slice(0, 500) });

        try {
          result = await client.countLeads(args.search_filters);
        } catch (err) {
          logger.error("[count_leads] API error on first attempt:", { error: err });
          return { count: 0, search_filters: args.search_filters };
        }

        logger.debug(`[count_leads] Initial count: ${result.count}`);

        // Surface filter warnings (e.g. unresolved locations) to the LLM so it informs the user
        const filterWarnings = result.warnings.length > 0
          ? { filter_warnings: result.warnings }
          : {};

        if (result.count > 0) {
          return { count: result.count, search_filters: args.search_filters, ...filterWarnings };
        }

        // ── Progressive auto-broadening ──
        const broadened = { ...args.search_filters };
        const broadened_fields: string[] = [];
        const ALL_EMPLOYEE_RANGES = [
          "0 - 25", "25 - 100", "100 - 250", "250 - 1000",
          "1K - 10K", "10K - 50K", "50K - 100K", "> 100K",
        ] as const;

        async function tryCount(label: string): Promise<number> {
          try {
            const retry = await client.countLeads(broadened);
            logger.debug(`[count_leads] ${label}: ${retry.count} leads`);
            if (retry.warnings.length > 0) {
              for (const w of retry.warnings) {
                if (!result.warnings.includes(w)) result.warnings.push(w);
              }
            }
            return retry.count;
          } catch (err) {
            logger.warn(`[count_leads] ${label} error:`, { error: err });
            return 0;
          }
        }

        // Step 1: Strip extras
        {
          const extras = [
            "keyword_filter", "news", "funding_type", "technologies",
            "job_listing", "lookalike_domain",
          ] as const;
          const removed: string[] = [];
          for (const key of extras) {
            if ((broadened as Record<string, unknown>)[key] !== undefined) {
              delete (broadened as Record<string, unknown>)[key];
              removed.push(key);
            }
          }
          if (removed.length > 0) {
            broadened_fields.push(...removed);
            const c = await tryCount("Step 1 (no extras)");
            if (c > 0) return { count: c, search_filters: broadened, broadened_fields, ...filterWarnings };
          }
        }

        // Step 2: Expand employee_count
        if (broadened.employee_count) {
          const current = broadened.employee_count as string[];
          if (current.length < ALL_EMPLOYEE_RANGES.length) {
            broadened.employee_count = [...ALL_EMPLOYEE_RANGES];
            broadened_fields.push("employee_count");
            const c = await tryCount("Step 2 (all employee ranges)");
            if (c > 0) return { count: c, search_filters: broadened, broadened_fields, ...filterWarnings };
            delete broadened.employee_count;
            const c2 = await tryCount("Step 2b (no employee_count)");
            if (c2 > 0) return { count: c2, search_filters: broadened, broadened_fields, ...filterWarnings };
          }
        }

        // Step 3: Remove revenue
        if (broadened.revenue) {
          delete broadened.revenue;
          broadened_fields.push("revenue");
          const c = await tryCount("Step 3 (no revenue)");
          if (c > 0) return { count: c, search_filters: broadened, broadened_fields, ...filterWarnings };
        }

        // Step 4: Remove job_titles
        if (broadened.job_titles) {
          delete broadened.job_titles;
          broadened_fields.push("job_titles");
          const c = await tryCount("Step 4 (no job_titles)");
          if (c > 0) return { count: c, search_filters: broadened, broadened_fields, ...filterWarnings };
        }

        // Step 5: Remove industries
        if (broadened.industries) {
          delete broadened.industries;
          broadened_fields.push("industries");
          const c = await tryCount("Step 5 (no industries)");
          if (c > 0) return { count: c, search_filters: broadened, broadened_fields, ...filterWarnings };
        }

        // STOP — never remove department or level
        logger.warn("[count_leads] All broadening steps exhausted, returning 0");
        return { count: 0, search_filters: broadened, broadened_fields, ...filterWarnings };
      },
    },

    preview_leads: {
      name: "preview_leads",
      description:
        "Preview sample leads for given search filters and render them as an inline table automatically. " +
        "Default: 30 leads. The user can request more or less. " +
        "Use the search_filters returned by count_leads. " +
        "DO NOT call render_lead_table after this — the table is already rendered. " +
        "DO NOT repeat the lead data in your text response — the table component handles the display.",
      parameters: z.object({
        search_filters: searchFiltersParam,
        limit: z.number().int().min(1).max(50).optional().describe("Number of leads to preview. Default 30."),
      }),
      async execute(args) {
        const previewLimit = args.limit ?? 30;
        const client = await getInstantlyClient(ctx.workspaceId);
        const { leads: rawLeads, warnings } = await client.previewLeads(args.search_filters);

        // Normalize to consistent format, deduplicate by name+company
        const normalized = rawLeads.map(normalizePreviewLead);
        const seen = new Set<string>();
        const unique = normalized.filter((l) => {
          const key = `${l.firstName ?? ""}|${l.lastName ?? ""}|${l.company ?? ""}`.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const leads = unique.slice(0, previewLimit);

        const leadsData = leads.map((l, i) => ({
          id: `preview-${i}`,
          firstName: l.firstName,
          lastName: l.lastName,
          email: l.email,
          company: l.company,
          jobTitle: l.jobTitle,
          linkedinUrl: l.linkedinUrl,
          icpScore: null,
          status: "PREVIEW",
        }));

        const summary = leadsData
          .filter((l) => l.firstName || l.company)
          .map((l) => `${l.firstName ?? "?"} ${l.lastName ?? ""} - ${l.company ?? "?"} (${l.jobTitle ?? "?"})`.trim())
          .join(", ");

        return {
          preview_count: leadsData.length,
          sample_summary: summary || "Preview data loaded",
          ...(warnings.length > 0 ? { filter_warnings: warnings } : {}),
          _display_note: "The lead table is already rendered as an inline component. Do NOT generate a markdown table or list the leads in your text. If filter_warnings is present, WARN the user about these issues BEFORE showing results.",
          __component: "lead-table",
          props: {
            title: `Lead preview (${leadsData.length} profiles)`,
            leads: leadsData,
          },
        };
      },
    },

    source_leads: {
      name: "source_leads",
      description: "Source leads via Instantly SuperSearch. This uses the client's credits. Returns lead_ids and campaign_id for chaining to score_leads_batch. If count_leads returned broadened_fields, pass them here so scoring can boost leads matching original criteria.",
      parameters: z.object({
        search_filters: searchFiltersParam,
        limit: z.number().int().min(1).max(10000),
        search_name: z.string(),
        list_name: z.string(),
        icp_description: z.string().describe("The user's original ICP description in natural language"),
        broadened_fields: z.array(z.string()).optional().describe("Filter fields that were removed during broadening (from count_leads). Pass as-is if present."),
      }),
      isSideEffect: true,
      async execute(args) {
        const client = await getInstantlyClient(ctx.workspaceId);
        ctx.onStatus?.("Launching SuperSearch sourcing...");

        // Start sourcing with email enrichment enabled
        const result = await client.sourceLeads({
          searchFilters: args.search_filters,
          limit: args.limit,
          searchName: args.search_name,
          listName: args.list_name,
          enrichment: { work_email_enrichment: true },
        });
        const resourceId = result.resourceId;
        const sourceWarnings = result.warnings;

        // Poll until complete (max 150s = 30 polls × 5s to stay within Vercel 300s timeout)
        const MAX_POLLS = 30;
        const POLL_INTERVAL = 5000;
        let inProgress = true;
        let pollCount = 0;
        while (inProgress) {
          pollCount++;
          if (pollCount > MAX_POLLS) {
            return {
              status: "timeout",
              message: `Instantly enrichment still in progress after ${(MAX_POLLS * POLL_INTERVAL) / 1000}s. Try again in a few minutes — leads may still be processing.`,
              resourceId,
            };
          }
          await new Promise((r) => setTimeout(r, POLL_INTERVAL));
          const status = await client.getEnrichmentStatus(resourceId);
          inProgress = status.inProgress;
          ctx.onStatus?.(`Sourcing in progress... (${pollCount}/${MAX_POLLS})`);
        }

        // Fetch ALL sourced leads with pagination
        ctx.onStatus?.("Fetching sourced leads...");
        const allLeads: Awaited<ReturnType<typeof client.listLeads>>["items"] = [];
        let cursor: string | undefined;
        do {
          const page = await client.listLeads({ listId: resourceId, limit: 100, startingAfter: cursor });
          allLeads.push(...page.items);
          cursor = page.nextStartingAfter;
        } while (cursor);

        // Extract industry from ICP filters
        const filters = args.search_filters as Record<string, unknown>;
        const icpIndustries = Array.isArray(filters.industries) ? filters.industries as string[] : [];
        const icpIndustry = icpIndustries.length > 0 ? icpIndustries.join(", ") : null;

        // Dedup: batch-query existing leads by email
        const allEmails = allLeads
          .map((l) => normalizeStoredLead(l).email)
          .filter((e): e is string => !!e);
        const uniqueEmails = [...new Set(allEmails.map((e) => e.toLowerCase()))];

        const existingLeads = uniqueEmails.length > 0
          ? await prisma.lead.findMany({
              where: { workspaceId: ctx.workspaceId, email: { in: uniqueEmails } },
              select: { id: true, email: true, status: true, campaignId: true },
            })
          : [];
        const existingByEmail = new Map(
          existingLeads.map((l) => [l.email.toLowerCase(), l]),
        );

        // Count existing leads by status for dedup report
        const statusCounts: Record<string, number> = {};
        let inActiveCampaign = 0;
        for (const ex of existingLeads) {
          statusCounts[ex.status] = (statusCounts[ex.status] ?? 0) + 1;
          if (ex.campaignId) inActiveCampaign++;
        }

        // Source-empty detection
        if (allLeads.length === 0) {
          return {
            sourced: 0,
            error: "Instantly sourcing returned 0 leads despite successful enrichment. " +
                   "This can happen when: (1) all leads were already in your account, " +
                   "(2) enrichment timed out, or (3) count endpoint over-estimated.",
            error_type: "SOURCE_EMPTY",
            resourceId,
            ...(sourceWarnings.length > 0 ? { filter_warnings: sourceWarnings } : {}),
          };
        }

        const newLeadIds: string[] = [];
        const skippedExisting: string[] = [];
        const failedLeads: { email: string; error: string }[] = [];
        let totalWithEmail = 0;

        for (const lead of allLeads) {
          const n = normalizeStoredLead(lead);
          if (!n.email) continue;
          totalWithEmail++;

          const emailLower = n.email.toLowerCase();

          if (existingByEmail.has(emailLower)) {
            skippedExisting.push(emailLower);
            continue;
          }

          try {
            const dbLead = await prisma.lead.create({
              data: {
                workspaceId: ctx.workspaceId,
                email: n.email,
                firstName: n.firstName,
                lastName: n.lastName,
                company: n.company,
                jobTitle: n.jobTitle,
                linkedinUrl: n.linkedinUrl,
                phone: n.phone,
                website: n.website,
                companyDomain: n.companyDomain,
                country: n.location,
                industry: icpIndustry,
                espListId: resourceId,
                status: "SOURCED",
              },
            });
            newLeadIds.push(dbLead.id);
          } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
              skippedExisting.push(emailLower);
              continue;
            }
            const errMsg = err instanceof Error ? err.message : "Unknown DB error";
            failedLeads.push({ email: emailLower, error: errMsg });
            if (errMsg.includes("does not exist") || errMsg.includes("column")) {
              break;
            }
            continue;
          }
        }

        // If ALL leads failed to save, return a structured error
        if (newLeadIds.length === 0 && failedLeads.length > 0) {
          const firstError = failedLeads[0].error;
          const isSchemaError = firstError.includes("does not exist");
          return {
            sourced: 0,
            error: isSchemaError
              ? `Database schema out of sync: ${firstError}. Run "npx prisma migrate deploy" to fix.`
              : `Failed to save ${failedLeads.length} leads to database: ${firstError}`,
            error_type: isSchemaError ? "SCHEMA_MISMATCH" : "DB_ERROR",
            api_leads_received: totalWithEmail,
            failed_count: failedLeads.length,
          };
        }

        // Create Campaign record to track pipeline progress
        const campaign = await prisma.campaign.create({
          data: {
            workspaceId: ctx.workspaceId,
            name: args.search_name,
            icpDescription: args.icp_description,
            icpFilters: args.search_filters as unknown as Prisma.InputJsonValue,
            broadenedFields: args.broadened_fields ?? [],
            espListId: resourceId,
            espType: "INSTANTLY",
            leadsTotal: newLeadIds.length,
            status: "SOURCING",
          },
        });

        // Link campaign ↔ conversation
        if (ctx.conversationId) {
          await prisma.conversation.update({
            where: { id: ctx.conversationId },
            data: { campaignId: campaign.id },
          });
        }

        // Link only NEW leads to campaign
        if (newLeadIds.length > 0) {
          await prisma.lead.updateMany({
            where: { id: { in: newLeadIds } },
            data: { campaignId: campaign.id },
          });
        }

        // Fetch actual sourced lead details for LLM context + UI
        const sourcedLeads = newLeadIds.length > 0
          ? await prisma.lead.findMany({
              where: { id: { in: newLeadIds } },
              select: { id: true, firstName: true, lastName: true, company: true, jobTitle: true, email: true },
            })
          : [];

        const sourcedSummary = sourcedLeads
          .map((l) => `${l.firstName ?? "?"} ${l.lastName ?? ""} - ${l.company ?? "?"} (${l.jobTitle ?? "?"}) <${l.email}>`.trim())
          .join(", ");

        return {
          sourced: newLeadIds.length,
          sourced_leads_summary: sourcedSummary || "No lead details available",
          listId: resourceId,
          lead_ids: newLeadIds,
          campaign_id: campaign.id,
          ...(sourceWarnings.length > 0 ? { filter_warnings: sourceWarnings } : {}),
          dedup: {
            existing_count: skippedExisting.length,
            by_status: statusCounts,
            in_active_campaign: inActiveCampaign,
            total_from_api: totalWithEmail,
          },
          ...(failedLeads.length > 0 ? {
            partial_failure: {
              failed_count: failedLeads.length,
              first_error: failedLeads[0].error,
            },
          } : {}),
          __component: "lead-table",
          props: {
            title: `Sourced leads (${sourcedLeads.length} profiles)`,
            leads: sourcedLeads.map((l) => ({
              id: l.id,
              firstName: l.firstName,
              lastName: l.lastName,
              email: l.email,
              company: l.company,
              jobTitle: l.jobTitle,
              linkedinUrl: null,
              icpScore: null,
              status: "SOURCED",
            })),
          },
        };
      },
    },
  };
}
