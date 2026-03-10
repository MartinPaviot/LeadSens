import { prisma } from "@/lib/prisma";
import type { WinningPattern } from "./prompt-builder";
import { POSITIVE_REPLY_INTEREST_THRESHOLD } from "@/server/lib/analytics/correlator";

/**
 * Captures a user's style correction for future email drafting.
 */
export async function captureStyleCorrection(
  workspaceId: string,
  original: string,
  edit: string,
  contentType: string,
): Promise<void> {
  await prisma.agentFeedback.create({
    data: {
      workspaceId,
      type: "USER_EDIT",
      originalOutput: original,
      userEdit: edit,
      metadata: { contentType },
    },
  });
}

/**
 * Retrieves recent style corrections to include in email prompts.
 */
export async function getStyleSamples(
  workspaceId: string,
  limit = 5,
): Promise<string[]> {
  const corrections = await prisma.agentFeedback.findMany({
    where: { workspaceId, type: "USER_EDIT" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return corrections.map(
    (c) => `Original: "${c.originalOutput}"\nCorrected: "${c.userEdit}"`,
  );
}

/**
 * Extracts patterns from emails that got replies.
 * Returns max 3 winning pattern summaries for injection into drafting prompt.
 */
export async function getWinningEmailPatterns(
  workspaceId: string,
): Promise<WinningPattern[]> {
  // Join DraftedEmail with EmailPerformance via Lead
  const winners = await prisma.draftedEmail.findMany({
    where: {
      lead: { workspaceId },
      signalType: { not: null },
    },
    select: {
      signalType: true,
      frameworkName: true,
      bodyWordCount: true,
      enrichmentDepth: true,
      qualityScore: true,
      body: true,
      lead: {
        select: {
          performance: {
            where: {
              replyCount: { gt: 0 },
              OR: [
                { replyAiInterest: null },
                { replyAiInterest: { gte: POSITIVE_REPLY_INTEREST_THRESHOLD } },
              ],
            },
            select: { replyCount: true },
          },
        },
      },
    },
  });

  // Filter to emails where the lead actually replied
  const replied = winners.filter((w) => w.lead.performance.length > 0);
  if (replied.length === 0) return [];

  // Count total emails with performance data for rate calculation
  const totalWithPerf = await prisma.draftedEmail.count({
    where: {
      lead: {
        workspaceId,
        performance: { some: {} },
      },
    },
  });

  const replyRate = totalWithPerf > 0 ? (replied.length / totalWithPerf) * 100 : 0;

  // Extract patterns from winning emails
  const patternCounts = new Map<string, { count: number; totalRate: number }>();
  for (const w of replied) {
    const key = [
      w.signalType ? `${w.signalType} signal` : null,
      w.bodyWordCount ? `${w.bodyWordCount} words` : null,
      w.frameworkName ? w.frameworkName : null,
      w.enrichmentDepth === "rich" ? "deep enrichment" : null,
    ].filter(Boolean).join(", ");

    if (!key) continue;
    const existing = patternCounts.get(key) ?? { count: 0, totalRate: 0 };
    existing.count++;
    existing.totalRate += replyRate;
    patternCounts.set(key, existing);
  }

  // Sort by frequency and return top 3
  return [...patternCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([summary, data]) => ({
      summary: `Winning email pattern (${data.count}x): ${summary}`,
      replyRate: data.totalRate / data.count,
    }));
}
