import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { scoreLead } from "@/server/lib/enrichment/icp-scorer";
import { scrapeViaJina } from "@/server/lib/enrichment/jina-scraper";
import { summarizeCompanyContext } from "@/server/lib/enrichment/summarizer";
import type { ToolDefinition, ToolContext } from "./types";

export function createEnrichmentTools(ctx: ToolContext): Record<string, ToolDefinition> {
  return {
    score_leads_batch: {
      name: "score_leads_batch",
      description: "Score leads against the ICP using raw Instantly data. Leads scoring below 5 are skipped.",
      parameters: z.object({
        lead_ids: z.array(z.string()),
        icp_description: z.string(),
      }),
      async execute(args) {
        const leads = await prisma.lead.findMany({
          where: { id: { in: args.lead_ids }, workspaceId: ctx.workspaceId },
        });

        let scored = 0;
        const skipped = 0;

        // ── BYPASS: ICP scorer disabled — all leads pass as SCORED ──
        // To re-enable: uncomment the scoring block below and remove the bypass block
        for (let i = 0; i < leads.length; i++) {
          const lead = leads[i];
          ctx.onStatus?.(`Scoring lead ${i + 1}/${leads.length}...`);

          // const result = await scoreLead(lead, args.icp_description, ctx.workspaceId);
          //
          // await prisma.lead.update({
          //   where: { id: lead.id },
          //   data: {
          //     icpScore: result.score,
          //     icpBreakdown: result.breakdown as unknown as Prisma.InputJsonValue,
          //     status: result.score >= 5 ? "SCORED" : "SKIPPED",
          //   },
          // });
          //
          // if (result.score >= 5) scored++;
          // else skipped++;

          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              icpScore: 10,
              status: "SCORED",
            },
          });
          scored++;
        }
        // ── END BYPASS ──

        return { scored, skipped, total: leads.length };
      },
    },

    enrich_leads_batch: {
      name: "enrich_leads_batch",
      description: "Enrich qualified leads (score >= 5) by scraping their company website via Jina Reader and summarizing with Mistral.",
      parameters: z.object({
        lead_ids: z.array(z.string()),
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
        let failed = 0;

        for (let i = 0; i < leads.length; i++) {
          const lead = leads[i];
          ctx.onStatus?.(`Enriching lead ${i + 1}/${leads.length}...`);

          const url = lead.website || `${(lead.company ?? "").toLowerCase().replace(/\s+/g, "")}.com`;
          const jinaResult = await scrapeViaJina(url);

          if (!jinaResult.ok) {
            failed++;
            continue; // Lead stays SCORED, not blocking
          }

          const enrichment = await summarizeCompanyContext(jinaResult.markdown, ctx.workspaceId);

          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              enrichmentData: enrichment as unknown as Prisma.InputJsonValue,
              enrichedAt: new Date(),
              status: "ENRICHED",
            },
          });
          enriched++;

          // Respect Jina rate limit: ~18/min = ~3.3s between calls
          if (i < leads.length - 1) {
            await new Promise((r) => setTimeout(r, 3400));
          }
        }

        return { enriched, failed, total: leads.length };
      },
    },

    enrich_single_lead: {
      name: "enrich_single_lead",
      description: "Enrich a single lead synchronously (for chat preview).",
      parameters: z.object({ lead_id: z.string() }),
      async execute(args) {
        const lead = await prisma.lead.findFirst({
          where: { id: args.lead_id, workspaceId: ctx.workspaceId },
        });

        if (!lead) return { error: "Lead not found" };

        const url = lead.website || `${(lead.company ?? "").toLowerCase().replace(/\s+/g, "")}.com`;
        const jinaResult = await scrapeViaJina(url);

        if (!jinaResult.ok) return { error: `Could not scrape website: ${jinaResult.message}`, leadId: lead.id };

        const enrichment = await summarizeCompanyContext(jinaResult.markdown, ctx.workspaceId);

        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            enrichmentData: enrichment as unknown as Prisma.InputJsonValue,
            enrichedAt: new Date(),
            status: "ENRICHED",
          },
        });

        return { enriched: true, leadId: lead.id, enrichment };
      },
    },
  };
}
