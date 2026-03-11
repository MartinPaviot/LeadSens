import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { WinningPattern } from "./prompt-builder";
import { POSITIVE_REPLY_INTEREST_THRESHOLD } from "@/server/lib/analytics/correlator";

// ─── Category Detection ─────────────────────────────────

export type StyleCategory = "subject" | "tone" | "cta" | "opener" | "length" | "general";

/**
 * Split text into sentences (non-empty, trimmed).
 */
function splitSentences(text: string): string[] {
  return text.split(/[.!?]\s+/).map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Auto-detect the category of a style correction based on heuristics.
 *
 * Priority: subject > length > opener > cta > tone > general
 */
export function detectCategory(original: string, edit: string): StyleCategory {
  // 0. No change = general (not a meaningful correction)
  if (original === edit) return "general";

  const origWords = original.split(/\s+/).filter((w) => w.length > 0);
  const editWords = edit.split(/\s+/).filter((w) => w.length > 0);

  // 1. Short text (≤8 words both sides) = subject line edit
  if (origWords.length <= 8 && editWords.length <= 8) return "subject";

  // 2. Word count changed significantly (>30%) = length edit
  const maxLen = Math.max(origWords.length, editWords.length);
  if (maxLen > 0) {
    const lengthDelta = Math.abs(origWords.length - editWords.length) / maxLen;
    if (lengthDelta > 0.3) return "length";
  }

  const origSentences = splitSentences(original);
  const editSentences = splitSentences(edit);

  // 3. First sentence changed but rest similar = opener edit
  if (
    origSentences.length > 1 &&
    editSentences.length > 1 &&
    origSentences[0] !== editSentences[0] &&
    origSentences.slice(1).join("|") === editSentences.slice(1).join("|")
  ) {
    return "opener";
  }

  // 4. Only the last sentence changes = CTA edit
  if (
    origSentences.length > 1 &&
    editSentences.length > 1 &&
    origSentences.slice(0, -1).join("|") === editSentences.slice(0, -1).join("|")
  ) {
    return "cta";
  }

  // 5. Similar length and structure but different wording = tone edit
  //    Heuristic: same sentence count, similar word count, but content differs
  if (
    origSentences.length === editSentences.length &&
    Math.abs(origWords.length - editWords.length) <= 5 &&
    original !== edit
  ) {
    return "tone";
  }

  return "general";
}

/**
 * Captures a user's style correction for future email drafting.
 * Auto-detects the category (subject, tone, cta, opener, length, general).
 */
export async function captureStyleCorrection(
  workspaceId: string,
  original: string,
  edit: string,
  contentType: string,
): Promise<void> {
  const category = detectCategory(original, edit);
  await prisma.agentFeedback.create({
    data: {
      workspaceId,
      type: "USER_EDIT",
      originalOutput: original,
      userEdit: edit,
      metadata: { contentType, category } as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Retrieves recent style corrections to include in email prompts.
 * Optionally filter by category for targeted injection.
 */
export async function getStyleSamples(
  workspaceId: string,
  limit = 5,
  category?: StyleCategory,
): Promise<string[]> {
  const where: Prisma.AgentFeedbackWhereInput = {
    workspaceId,
    type: "USER_EDIT",
    ...(category ? {
      metadata: {
        path: ["category"],
        equals: category,
      },
    } : {}),
  };

  const corrections = await prisma.agentFeedback.findMany({
    where,
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
