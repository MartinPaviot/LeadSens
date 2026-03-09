/**
 * Backfill script: populate flat enrichment columns from existing enrichmentData JSON.
 * Purely deterministic — 0 LLM calls.
 *
 * Usage: npx tsx scripts/backfill-flat-enrichment.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { enrichmentDataSchema, extractFlatEnrichmentFields } from "../src/server/lib/enrichment/summarizer";

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

async function main() {
  let offset = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  // Count total leads needing backfill
  const total = await prisma.lead.count({
    where: {
      enrichmentData: { not: Prisma.JsonNull },
      companyOneLiner: null,
    },
  });

  console.log(`Found ${total} leads to backfill.`);
  if (total === 0) {
    console.log("Nothing to do.");
    return;
  }

  while (true) {
    const leads = await prisma.lead.findMany({
      where: {
        enrichmentData: { not: Prisma.JsonNull },
        companyOneLiner: null,
      },
      select: {
        id: true,
        enrichmentData: true,
      },
      take: BATCH_SIZE,
      // No offset needed — we filter on companyOneLiner IS NULL,
      // so processed leads drop out of the query automatically.
    });

    if (leads.length === 0) break;

    for (const lead of leads) {
      const parsed = enrichmentDataSchema.safeParse(lead.enrichmentData);
      if (!parsed.success) {
        totalSkipped++;
        // Still set a marker so we don't re-process
        await prisma.lead.update({
          where: { id: lead.id },
          data: { companyOneLiner: "" },
        });
        continue;
      }

      const flatFields = extractFlatEnrichmentFields(parsed.data);
      await prisma.lead.update({
        where: { id: lead.id },
        data: flatFields,
      });
      totalUpdated++;
    }

    offset += leads.length;
    console.log(`Backfilled ${offset}/${total} leads (${totalUpdated} updated, ${totalSkipped} skipped)...`);
  }

  console.log(`\nDone. ${totalUpdated} leads updated, ${totalSkipped} skipped (invalid JSON).`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
