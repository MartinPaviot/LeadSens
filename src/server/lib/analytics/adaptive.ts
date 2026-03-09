import { getReplyRateBySignalType, getReplyRateByStep } from "./correlator";
import type { StepPerformanceAnnotation } from "@/server/lib/email/prompt-builder";

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
