import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { scoreLead } from "@/server/lib/enrichment/icp-scorer";
import { scrapeViaJina } from "@/server/lib/enrichment/jina-scraper";
import { summarizeCompanyContext } from "@/server/lib/enrichment/summarizer";
import type { ToolDefinition, ToolContext } from "./types";

/**
 * Resolves the best URL to scrape for a lead.
 * Priority: lead.website > guessed domain from company name.
 * Ensures https:// prefix for Jina Reader.
 */
function resolveLeadUrl(lead: { website?: string | null; company?: string | null }): string | null {
  // Use explicit website/domain if available
  const raw = lead.website?.trim();
  if (raw) {
    // Add https:// if missing
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    return `https://${raw}`;
  }

  // No website at all — don't guess, return null
  if (!lead.company) return null;

  // Fallback: guess domain from company name (fragile but better than nothing)
  const guess = lead.company.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
  return `https://${guess}`;
}

export function createEnrichmentTools(ctx: ToolContext): Record<string, ToolDefinition> {
  return {
    score_leads_batch: {
      name: "score_leads_batch",
      description: "Score leads against the ICP using raw Instantly data. Leads scoring below 5 are skipped. Returns lead_ids of qualified leads for chaining to enrich_leads_batch.",
      parameters: z.object({
        lead_ids: z.array(z.string()),
        icp_description: z.string(),
        campaign_id: z.string().optional().describe("Campaign ID to update stats on"),
      }),
      async execute(args) {
        const leads = await prisma.lead.findMany({
          where: { id: { in: args.lead_ids }, workspaceId: ctx.workspaceId },
        });

        let scored = 0;
        let skipped = 0;
        const qualifiedIds: string[] = [];

        for (let i = 0; i < leads.length; i++) {
          const lead = leads[i];
          ctx.onStatus?.(`Scoring lead ${i + 1}/${leads.length}: ${lead.firstName ?? ""} ${lead.lastName ?? ""}`);

          const result = await scoreLead(lead, args.icp_description, ctx.workspaceId);

          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              icpScore: result.score,
              icpBreakdown: result.breakdown as unknown as Prisma.InputJsonValue,
              status: result.score >= 5 ? "SCORED" : "SKIPPED",
            },
          });

          if (result.score >= 5) {
            scored++;
            qualifiedIds.push(lead.id);
          } else {
            skipped++;
          }
        }

        // Update campaign stats
        if (args.campaign_id) {
          await prisma.campaign.update({
            where: { id: args.campaign_id },
            data: { leadsScored: scored, leadsSkipped: skipped, status: "SCORING" },
          });
        }

        return { scored, skipped, total: leads.length, lead_ids: qualifiedIds };
      },
    },

    enrich_leads_batch: {
      name: "enrich_leads_batch",
      description: "Enrich qualified leads (score >= 5) by scraping their company website via Jina Reader and summarizing with Mistral. Leads that can't be scraped still advance to ENRICHED (with partial data) so they can be drafted. Returns lead_ids for chaining to draft_emails_batch.",
      parameters: z.object({
        lead_ids: z.array(z.string()),
        campaign_id: z.string().optional().describe("Campaign ID to update stats on"),
      }),
      async execute(args) {
        const leads = await prisma.lead.findMany({
          where: {
            id: { in: args.lead_ids },
            workspaceId: ctx.workspaceId,
            status: "SCORED",
          },
        });

        let enriched = 0;
        let scraped = 0;
        let scrapeFailed = 0;
        const enrichedIds: string[] = [];

        for (let i = 0; i < leads.length; i++) {
          const lead = leads[i];
          ctx.onStatus?.(`Enriching lead ${i + 1}/${leads.length}...`);

          const url = resolveLeadUrl(lead);
          let enrichment: unknown = null;

          if (url) {
            const jinaResult = await scrapeViaJina(url);

            if (jinaResult.ok) {
              enrichment = await summarizeCompanyContext(jinaResult.markdown, ctx.workspaceId);
              scraped++;
            } else {
              console.warn(`[enrich] Scrape failed for ${lead.company ?? lead.email}: ${jinaResult.message} (url: ${url})`);
              scrapeFailed++;
            }
          } else {
            console.warn(`[enrich] No URL for ${lead.company ?? lead.email} — skipping scrape`);
            scrapeFailed++;
          }

          // Always advance to ENRICHED — even without scrape data,
          // the lead can still be drafted using basic Instantly data
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              ...(enrichment ? {
                enrichmentData: enrichment as unknown as Prisma.InputJsonValue,
              } : {}),
              enrichedAt: new Date(),
              status: "ENRICHED",
            },
          });
          enriched++;
          enrichedIds.push(lead.id);

          // Respect Jina rate limit: ~18/min = ~3.3s between calls
          if (url && i < leads.length - 1) {
            await new Promise((r) => setTimeout(r, 3400));
          }
        }

        // Update campaign stats
        if (args.campaign_id) {
          await prisma.campaign.update({
            where: { id: args.campaign_id },
            data: { leadsEnriched: enriched, status: "ENRICHING" },
          });
        }

        return {
          enriched,
          scraped,
          scrape_failed: scrapeFailed,
          total: leads.length,
          lead_ids: enrichedIds,
        };
      },
    },

    enrich_single_lead: {
      name: "enrich_single_lead",
      description: "Enrich a single lead synchronously (for chat preview). Advances to ENRICHED even if scraping fails.",
      parameters: z.object({ lead_id: z.string() }),
      async execute(args) {
        const lead = await prisma.lead.findFirst({
          where: { id: args.lead_id, workspaceId: ctx.workspaceId },
        });

        if (!lead) return { error: "Lead not found" };

        const url = resolveLeadUrl(lead);
        let enrichment: unknown = null;
        let scrapeError: string | null = null;

        if (url) {
          const jinaResult = await scrapeViaJina(url);
          if (jinaResult.ok) {
            enrichment = await summarizeCompanyContext(jinaResult.markdown, ctx.workspaceId);
          } else {
            scrapeError = jinaResult.message;
          }
        } else {
          scrapeError = "No website URL available";
        }

        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            ...(enrichment ? {
              enrichmentData: enrichment as unknown as Prisma.InputJsonValue,
            } : {}),
            enrichedAt: new Date(),
            status: "ENRICHED",
          },
        });

        return {
          enriched: true,
          scraped: !!enrichment,
          scrapeError,
          leadId: lead.id,
          enrichment,
        };
      },
    },
  };
}
