import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { WinningPattern, WinningSubject } from "./prompt-builder";
import { POSITIVE_REPLY_INTEREST_THRESHOLD } from "@/server/lib/analytics/correlator";

// ─── Category Detection ─────────────────────────────────

export type StyleCategory = "subject" | "tone" | "cta" | "opener" | "length" | "general";

/** Categories relevant to email body drafting (everything except subject) */
export const BODY_STYLE_CATEGORIES: StyleCategory[] = ["tone", "opener", "cta", "length", "general"];

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
 * Optionally filter by single category or array of categories.
 */
export async function getStyleSamples(
  workspaceId: string,
  limit = 5,
  category?: StyleCategory | StyleCategory[],
): Promise<string[]> {
  const categoryFilter = category
    ? Array.isArray(category)
      ? { OR: category.map((c) => ({ metadata: { path: ["category"], equals: c } })) }
      : { metadata: { path: ["category"], equals: category } }
    : {};

  const where: Prisma.AgentFeedbackWhereInput = {
    workspaceId,
    type: "USER_EDIT",
    ...categoryFilter,
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

// ─── Variant Resolution ─────────────────────────────────

/**
 * Resolve the actual subject text based on which variant was sent.
 * variantIndex: 0 = primary subject, 1 = first alt (variants[0]), 2 = second alt (variants[1]).
 * Falls back to primary if variantIndex is null or out of range.
 */
export function resolveVariantSubject(
  primary: string,
  variants: unknown,
  variantIndex: number | null,
): string {
  if (variantIndex === null || variantIndex === 0) return primary;
  const arr = Array.isArray(variants) ? variants : [];
  return (typeof arr[variantIndex - 1] === "string" ? arr[variantIndex - 1] : null) ?? primary;
}

// ─── Winning Pattern Helpers ────────────────────────────

export interface WinningEmailData {
  signalType: string | null;
  bodyWordCount: number | null;
  frameworkName: string | null;
  enrichmentDepth: string | null;
}

/**
 * Build a human-readable pattern key from email metadata.
 * Returns empty string if no meaningful metadata is present.
 */
export function buildPatternKey(data: WinningEmailData): string {
  return [
    data.signalType ? `${data.signalType} signal` : null,
    data.bodyWordCount ? `${data.bodyWordCount} words` : null,
    data.frameworkName ? data.frameworkName : null,
    data.enrichmentDepth === "rich" ? "deep enrichment" : null,
  ].filter(Boolean).join(", ");
}

/**
 * Rank patterns by frequency and return top 3 as WinningPattern[].
 */
export function rankPatterns(
  patternCounts: Map<string, { count: number; totalRate: number }>,
): WinningPattern[] {
  return [...patternCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([summary, data]) => ({
      summary: `Winning email pattern (${data.count}x): ${summary}`,
      replyRate: data.totalRate / data.count,
    }));
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
    const key = buildPatternKey(w);
    if (!key) continue;
    const existing = patternCounts.get(key) ?? { count: 0, totalRate: 0 };
    existing.count++;
    existing.totalRate += replyRate;
    patternCounts.set(key, existing);
  }

  // Sort by frequency and return top 3
  return rankPatterns(patternCounts);
}

// ─── Winning Subject Propagation ────────────────────────

// WinningSubject is imported from prompt-builder.ts and re-exported
export type { WinningSubject } from "./prompt-builder";

/**
 * Retrieves subject lines from past campaigns that received positive replies.
 * Resolves the actual variant text that was sent using variantIndex attribution.
 * Returns deduplicated subjects sorted by reply count (most proven first).
 */
export async function getWinningSubjects(
  workspaceId: string,
  limit: number = 6,
): Promise<WinningSubject[]> {
  const emails = await prisma.draftedEmail.findMany({
    where: {
      lead: {
        workspaceId,
        performance: {
          some: {
            replyCount: { gt: 0 },
            OR: [
              { replyAiInterest: null },
              { replyAiInterest: { gte: POSITIVE_REPLY_INTEREST_THRESHOLD } },
            ],
          },
        },
      },
    },
    select: {
      subject: true,
      subjectVariants: true,
      subjectPattern: true,
      step: true,
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
            select: { variantIndex: true },
          },
        },
      },
    },
    take: 100, // Cap query size
  });

  // Resolve actual subject text per replied email, deduplicate
  const subjectMap = new Map<string, { subject: string; pattern: string; step: number; count: number }>();

  for (const email of emails) {
    for (const perf of email.lead.performance) {
      const actualSubject = resolveVariantSubject(
        email.subject,
        email.subjectVariants,
        perf.variantIndex,
      );
      const key = actualSubject.toLowerCase();
      const existing = subjectMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        subjectMap.set(key, {
          subject: actualSubject,
          pattern: email.subjectPattern ?? "unknown",
          step: email.step,
          count: 1,
        });
      }
    }
  }

  return [...subjectMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ count, ...rest }) => ({ ...rest, replies: count }));
}
