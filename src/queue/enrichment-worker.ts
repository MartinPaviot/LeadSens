import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { scrapeViaJina } from "@/server/lib/connectors/jina";
import { summarizeCompanyContext } from "@/server/lib/enrichment/summarizer";
import { createWorker } from "./factory";

interface EnrichmentJobData {
  leadId: string;
  workspaceId: string;
}

export const enrichmentWorker = createWorker(
  "enrichment:batch",
  async (job: { data: EnrichmentJobData }) => {
    const { leadId, workspaceId } = job.data;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead || lead.status === "SKIPPED") return;

    const url =
      lead.website ||
      `${(lead.company ?? "").toLowerCase().replace(/\s+/g, "")}.com`;

    const jinaResult = await scrapeViaJina(url);
    if (!jinaResult.ok) return; // Jina fail → lead stays SCORED
    const markdown = jinaResult.markdown;

    const enrichment = await summarizeCompanyContext(markdown, workspaceId);

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        enrichmentData: enrichment as unknown as Prisma.InputJsonValue,
        enrichedAt: new Date(),
        status: "ENRICHED",
      },
    });
  },
  {
    concurrency: 3,
    limiter: { max: 18, duration: 60_000 }, // 18/min (Jina rate limit)
  },
);
