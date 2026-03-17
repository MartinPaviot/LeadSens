import { getReplyRateBySignalType, getReplyRateByStep, getReplyRateByCta } from "./correlator";
import { rankPatternsByThompson, type PatternStats } from "./thompson-sampling";
import type { StepPerformanceAnnotation } from "@/server/lib/email/prompt-builder";
import { DEFAULT_SIGNAL_WEIGHTS } from "@/server/lib/email/prompt-builder";

const FRAMEWORK_NAMES = [
  "PAS (Timeline Hook)", "Value-add", "Social Proof",
  "New Angle", "Micro-value", "Breakup",
];

/**
 * Computes data-driven signal weights from correlation data.
 * Returns null if insufficient data (< 20 per signal type).
 */
export async function getDataDrivenWeights(
  workspaceId: string,
): Promise<Record<string, number> | null> {
  const rows = await getReplyRateBySignalType(workspaceId);

  // Need at least 2 signal types with meaningful data
  const significant = rows.filter((r) => r.sent >= 20);
  if (significant.length < 2) return null;

  // Normalize reply rates to 0-10 scale
  const maxRate = Math.max(...significant.map((r) => r.replyRate));
  if (maxRate === 0) return null;

  const weights: Record<string, number> = {};
  for (const row of significant) {
    weights[row.dimension] = (row.replyRate / maxRate) * 10;
  }

  return weights;
}

/**
 * Gets performance annotation for a specific email step.
 * Only returns annotation with high confidence (>= 50 emails at that step).
 */
export async function getStepAnnotation(
  workspaceId: string,
  step: number,
): Promise<StepPerformanceAnnotation | null> {
  const rows = await getReplyRateByStep(workspaceId);

  if (rows.length < 2) return null;

  const thisStep = rows.find((r) => r.dimension === (FRAMEWORK_NAMES[step] ?? `Step ${step}`));
  if (!thisStep || thisStep.sent < 50) return null;

  // Determine if this is the top step
  const maxReplyRate = Math.max(...rows.map((r) => r.replyRate));

  return {
    stepName: FRAMEWORK_NAMES[step] ?? `Step ${step}`,
    replyRate: thisStep.replyRate,
    sampleSize: thisStep.sent,
    isTop: thisStep.replyRate === maxReplyRate,
  };
}

// ─── Thompson Sampling: Signal Type Ranking ──────────────────────────

const SIGNAL_RANKING_MIN_SENT = 30;

/**
 * Rank signal types using Thompson Sampling instead of linear ratio.
 * Returns weights as Record<string, number> (0-10 scale) matching
 * the same signature as getDataDrivenWeights, so callers don't change.
 *
 * Falls back to DEFAULT_SIGNAL_WEIGHTS when insufficient data.
 */
export async function getSignalRanking(
  workspaceId: string,
): Promise<Record<string, number> | null> {
  const rows = await getReplyRateBySignalType(workspaceId);

  const totalSent = rows.reduce((sum, r) => sum + r.sent, 0);
  if (totalSent < SIGNAL_RANKING_MIN_SENT || rows.length < 2) return null;

  const patterns: PatternStats[] = rows.map((r) => ({
    name: r.dimension,
    sent: r.sent,
    replied: r.replied,
  }));

  const ranked = rankPatternsByThompson(patterns);
  if (ranked.length === 0) return null;

  // Convert Thompson scores to 0-10 weights (highest = 10)
  const maxScore = ranked[0].score;
  if (maxScore === 0) return null;

  const weights: Record<string, number> = {};
  for (const r of ranked) {
    weights[r.name] = (r.score / maxScore) * 10;
  }

  // Backfill signal types not yet observed with low default weights
  for (const [key, defaultWeight] of Object.entries(DEFAULT_SIGNAL_WEIGHTS)) {
    if (!(key in weights)) {
      weights[key] = defaultWeight * 0.5; // exploration: half default weight
    }
  }

  return weights;
}

// ─── Thompson Sampling: CTA Ranking ──────────────────────────────────

const CTA_RANKING_MIN_SENT = 30;

/**
 * Rank CTAs by step using Thompson Sampling.
 * Returns the ranked CTA names for a given step, or null if insufficient data.
 */
export async function getCtaRanking(
  workspaceId: string,
  step: number,
): Promise<string[] | null> {
  const rows = await getReplyRateByCta(workspaceId);

  // Filter to CTAs used in this step (ctaUsed is stored per DraftedEmail which has step)
  // correlator returns all CTAs — filter client-side for the step
  const stepRows = rows.filter((r) => r.dimension.startsWith(`s${step}:`));

  const totalSent = stepRows.reduce((sum, r) => sum + r.sent, 0);
  if (totalSent < CTA_RANKING_MIN_SENT || stepRows.length < 2) return null;

  const patterns: PatternStats[] = stepRows.map((r) => ({
    name: r.dimension.replace(`s${step}:`, ""), // strip step prefix
    sent: r.sent,
    replied: r.replied,
  }));

  const ranked = rankPatternsByThompson(patterns);
  return ranked.map((r) => r.name);
}
