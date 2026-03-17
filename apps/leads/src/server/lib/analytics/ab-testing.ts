/**
 * A/B Testing — Statistical significance detection + auto-pause of losing variants
 *
 * Uses two-proportion z-test to detect statistically significant differences
 * between A/B subject line variants. When a loser is found with 95% confidence,
 * the variant is disabled via the ESP API to concentrate volume on the winner.
 *
 * Research: RESEARCH-LANDSCAPE §R6.3, RESEARCH-DELIVERABILITY §11.1
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getReplyRateBySubjectVariant, type VariantPerformanceRow } from "./correlator";
import { getESPProvider } from "@/server/lib/providers";

// ─── Thresholds ────────────────────────────────────────

/** Minimum sends per variant before running z-test */
export const MIN_SENDS_PER_VARIANT = 100;

/** Minimum campaign age in days before running z-test */
export const MIN_CAMPAIGN_AGE_DAYS = 5;

/** Z-score threshold for 95% confidence (two-tailed) */
export const Z_THRESHOLD_95 = 1.96;

// ─── Types ─────────────────────────────────────────────

export interface ZTestResult {
  /** Calculated z-score */
  z: number;
  /** Whether the difference is statistically significant at 95% confidence */
  significant: boolean;
}

export interface VariantComparisonResult {
  /** The winning variant (higher reply rate) */
  winner: VariantPerformanceRow;
  /** The losing variant (lower reply rate) */
  loser: VariantPerformanceRow;
  /** Z-test result */
  zTest: ZTestResult;
}

export interface AutoPauseResult {
  /** Whether a variant was paused */
  paused: boolean;
  /** The comparison result if a significant difference was found */
  comparison?: VariantComparisonResult;
  /** Reason why no action was taken */
  reason?: string;
  /** Human-readable message if paused */
  message?: string;
}

// ─── Core Logic (pure, testable) ───────────────────────

/**
 * Two-proportion z-test for comparing two conversion rates.
 * Pure function — no side effects.
 *
 * Formula: z = (p1 - p2) / sqrt(p_pool * (1 - p_pool) * (1/n1 + 1/n2))
 * where p_pool = (x1 + x2) / (n1 + n2)
 *
 * @param n1 - Sample size for variant 1 (sends)
 * @param x1 - Successes for variant 1 (positive replies)
 * @param n2 - Sample size for variant 2 (sends)
 * @param x2 - Successes for variant 2 (positive replies)
 */
export function calculateZTest(n1: number, x1: number, n2: number, x2: number): ZTestResult {
  if (n1 <= 0 || n2 <= 0) {
    return { z: 0, significant: false };
  }

  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const pPool = (x1 + x2) / (n1 + n2);

  // If pooled proportion is 0 or 1, no variance — can't compute z
  if (pPool === 0 || pPool === 1) {
    return { z: 0, significant: false };
  }

  const standardError = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));

  if (standardError === 0) {
    return { z: 0, significant: false };
  }

  const z = (p1 - p2) / standardError;

  return {
    z: Math.round(z * 1000) / 1000, // 3 decimal places
    significant: Math.abs(z) > Z_THRESHOLD_95,
  };
}

/**
 * Check if conditions are met to run the z-test.
 * Pure function — no side effects.
 *
 * @param variants - Variant performance data
 * @param campaignCreatedAt - When the campaign was created
 */
export function canRunZTest(
  variants: VariantPerformanceRow[],
  campaignCreatedAt: Date,
): { eligible: boolean; reason?: string } {
  if (variants.length < 2) {
    return { eligible: false, reason: "Need at least 2 variants with data" };
  }

  const daysSinceCreation = (Date.now() - campaignCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreation < MIN_CAMPAIGN_AGE_DAYS) {
    return { eligible: false, reason: `Campaign is ${daysSinceCreation.toFixed(1)} days old (minimum ${MIN_CAMPAIGN_AGE_DAYS})` };
  }

  const insufficientVariants = variants.filter((v) => v.sent < MIN_SENDS_PER_VARIANT);
  if (insufficientVariants.length > 0) {
    return {
      eligible: false,
      reason: `Variant(s) ${insufficientVariants.map((v) => v.variantIndex).join(", ")} have < ${MIN_SENDS_PER_VARIANT} sends`,
    };
  }

  return { eligible: true };
}

/**
 * Find the losing variant via pairwise z-test comparison.
 * Returns the variant with the lowest reply rate if the difference is significant.
 * Pure function — no side effects.
 *
 * @param variants - Variant performance rows (already filtered by min sends in toVariantPerformanceRows)
 * @param campaignCreatedAt - When the campaign was created
 */
export function findLosingVariant(
  variants: VariantPerformanceRow[],
  campaignCreatedAt: Date,
): VariantComparisonResult | null {
  const { eligible } = canRunZTest(variants, campaignCreatedAt);
  if (!eligible) return null;

  // Sort by reply rate descending — best performer first
  const sorted = [...variants].sort((a, b) => b.replyRate - a.replyRate);

  // Compare best vs worst
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  // Same variant or same rate — no loser
  if (best.variantIndex === worst.variantIndex || best.replyRate === worst.replyRate) {
    return null;
  }

  const zTest = calculateZTest(best.sent, best.replied, worst.sent, worst.replied);

  if (!zTest.significant) return null;

  return {
    winner: best,
    loser: worst,
    zTest,
  };
}

// ─── DB + API Integration ──────────────────────────────

/**
 * Check variant performance for a campaign and auto-pause the loser if significant.
 * Called from the analytics sync cron after syncing campaign data.
 *
 * Respects workspace autonomy level:
 * - AUTO: disable variant immediately + notify
 * - SUPERVISED / MANUAL: notify only (agent suggests action)
 */
export async function checkAndPauseLosingVariant(
  campaignId: string,
): Promise<AutoPauseResult> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      name: true,
      espCampaignId: true,
      workspaceId: true,
      status: true,
      createdAt: true,
    },
  });

  if (!campaign?.espCampaignId) {
    return { paused: false, reason: "No ESP campaign ID" };
  }

  // Only check active campaigns
  if (campaign.status !== "PUSHED" && campaign.status !== "ACTIVE") {
    return { paused: false, reason: "Campaign not active" };
  }

  // Get variant performance (uses positive-reply-only counts)
  const variants = await getReplyRateBySubjectVariant(
    campaign.workspaceId,
    campaign.id,
  );

  // Check eligibility and find loser
  const comparison = findLosingVariant(variants, campaign.createdAt);

  if (!comparison) {
    const { reason } = canRunZTest(variants, campaign.createdAt);
    return { paused: false, reason: reason ?? "No significant difference found" };
  }

  // Check workspace autonomy level
  const workspace = await prisma.workspace.findUnique({
    where: { id: campaign.workspaceId },
    select: { autonomyLevel: true },
  });

  const autonomyLevel = workspace?.autonomyLevel ?? "SUPERVISED";

  const winPercent = comparison.winner.replyRate.toFixed(1);
  const losePercent = comparison.loser.replyRate.toFixed(1);
  const message = `A/B test result for "${campaign.name}": Variant "${comparison.winner.subject}" (${winPercent}% reply) outperforms "${comparison.loser.subject}" (${losePercent}% reply) with 95% confidence (z=${comparison.zTest.z}). ${autonomyLevel === "AUTO" ? "Losing variant auto-paused." : "Consider pausing the losing variant."}`;

  if (autonomyLevel === "AUTO") {
    // Disable the losing variant via Instantly API
    const disabled = await disableVariantViaESP(
      campaign.workspaceId,
      campaign.espCampaignId,
      comparison.loser.variantIndex,
    );

    if (!disabled) {
      await storeVariantNotification(campaign.workspaceId, campaignId, message.replace("auto-paused", "should be paused (API call failed)"));
      return { paused: false, comparison, reason: "ESP API call failed", message };
    }

    await storeVariantNotification(campaign.workspaceId, campaignId, message);
    logger.info("[ab-testing] Auto-paused losing variant", {
      campaignId,
      loserIndex: comparison.loser.variantIndex,
      z: comparison.zTest.z,
    });

    return { paused: true, comparison, message };
  }

  // SUPERVISED / MANUAL — just notify, don't auto-pause
  await storeVariantNotification(campaign.workspaceId, campaignId, message);
  return { paused: false, comparison, reason: `Autonomy level is ${autonomyLevel} — notification sent`, message };
}

/**
 * Disable a variant via the ESP provider abstraction.
 * Each ESP implements disableVariant() differently:
 * - Instantly: sets v_disabled on the variant in campaign sequences
 * - Smartlead/Lemlist: returns false (no API support for variant disabling)
 *
 * @param variantIndex - 0-indexed variant (0=primary, 1=v2, 2=v3)
 * @returns true if successfully disabled
 */
async function disableVariantViaESP(
  workspaceId: string,
  espCampaignId: string,
  variantIndex: number,
): Promise<boolean> {
  try {
    const esp = await getESPProvider(workspaceId);
    if (!esp) {
      logger.warn("[ab-testing] No ESP provider found", { workspaceId });
      return false;
    }

    // Step 0 is the primary A/B testing step
    return await esp.disableVariant(espCampaignId, 0, variantIndex);
  } catch (error) {
    logger.error("[ab-testing] Failed to disable variant", {
      espCampaignId,
      variantIndex,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Store a system message in the campaign's conversation to notify the user.
 * Exported for reuse by feedback loop (applyInsights).
 */
export async function storeCampaignNotification(
  workspaceId: string,
  campaignId: string,
  message: string,
  prefix: string = "A/B Test Result",
): Promise<void> {
  let conversation = await prisma.conversation.findFirst({
    where: { campaignId, workspaceId },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        workspaceId,
        campaignId,
        title: "Campaign Conversation",
      },
    });
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: `📊 **${prefix}**\n\n${message}`,
    },
  });
}

/** @deprecated Use storeCampaignNotification instead */
const storeVariantNotification = storeCampaignNotification;
