/**
 * Bounce Guard — Auto-pause campaigns on bounce spike
 *
 * Research D4: bounce >3% after 50+ sends destroys domain reputation.
 * This module checks bounce rate per campaign and triggers auto-pause
 * via the Instantly API when the threshold is exceeded.
 */

import { prisma } from "@/lib/prisma";
import { getESPProvider } from "@/server/lib/providers";
import { logger } from "@/lib/logger";

// ─── Thresholds ────────────────────────────────────────
export const BOUNCE_RATE_THRESHOLD = 0.03; // 3%
export const MIN_SENDS_FOR_CHECK = 50;

// ─── Types ─────────────────────────────────────────────

export interface BounceCheckResult {
  /** Whether the campaign was auto-paused */
  paused: boolean;
  /** Total sends tracked for this campaign */
  totalSends: number;
  /** Total bounces tracked for this campaign */
  totalBounces: number;
  /** Bounce rate as a decimal (e.g. 0.042 = 4.2%) */
  bounceRate: number;
  /** Human-readable message if paused */
  message?: string;
}

// ─── Core Logic (pure, testable) ───────────────────────

/**
 * Determine if a campaign should be paused based on bounce stats.
 * Pure function — no side effects.
 */
export function shouldPauseCampaign(
  totalSends: number,
  totalBounces: number,
): { shouldPause: boolean; bounceRate: number } {
  if (totalSends < MIN_SENDS_FOR_CHECK) {
    return { shouldPause: false, bounceRate: totalSends > 0 ? totalBounces / totalSends : 0 };
  }
  const bounceRate = totalBounces / totalSends;
  return {
    shouldPause: bounceRate > BOUNCE_RATE_THRESHOLD,
    bounceRate,
  };
}

// ─── DB + API Integration ──────────────────────────────

/**
 * Check bounce rate for a campaign and auto-pause if threshold exceeded.
 * Called from the webhook handler after each bounce event.
 *
 * @param campaignId - Internal campaign ID (not Instantly ID)
 * @returns BounceCheckResult with pause status and stats
 */
export async function checkAndPauseCampaign(campaignId: string): Promise<BounceCheckResult> {
  // Get campaign with Instantly ID and workspace
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      name: true,
      espCampaignId: true,
      workspaceId: true,
      status: true,
    },
  });

  if (!campaign?.espCampaignId) {
    return { paused: false, totalSends: 0, totalBounces: 0, bounceRate: 0 };
  }

  // Already paused or not active — skip
  if (campaign.status !== "PUSHED" && campaign.status !== "ACTIVE") {
    return { paused: false, totalSends: 0, totalBounces: 0, bounceRate: 0 };
  }

  // Count total leads pushed (= total sends potential) and bounces from EmailPerformance
  const [perfStats] = await prisma.$queryRaw<
    Array<{ total_sends: bigint; total_bounces: bigint }>
  >`
    SELECT
      COUNT(*)::bigint AS total_sends,
      COUNT(*) FILTER (WHERE bounced = true)::bigint AS total_bounces
    FROM email_performance
    WHERE "campaignId" = ${campaignId}
  `;

  // Also count leads pushed without EmailPerformance yet (sent by Instantly but no webhook yet)
  const leadsPushed = await prisma.lead.count({
    where: { campaignId, status: { in: ["PUSHED", "SENT", "REPLIED", "INTERESTED", "NOT_INTERESTED", "MEETING_BOOKED", "BOUNCED", "UNSUBSCRIBED"] } },
  });

  // Use the larger of the two counts as total sends (EmailPerformance may lag behind actual sends)
  const perfSends = Number(perfStats?.total_sends ?? 0);
  const totalSends = Math.max(perfSends, leadsPushed);
  const totalBounces = Number(perfStats?.total_bounces ?? 0);

  const { shouldPause, bounceRate } = shouldPauseCampaign(totalSends, totalBounces);

  if (!shouldPause) {
    return { paused: false, totalSends, totalBounces, bounceRate };
  }

  // Get ESP provider to pause campaign
  const esp = await getESPProvider(campaign.workspaceId);

  if (!esp) {
    logger.warn(`[bounce-guard] Cannot auto-pause campaign ${campaign.name}: no active ESP integration`);
    return { paused: false, totalSends, totalBounces, bounceRate };
  }

  const bouncePercent = (bounceRate * 100).toFixed(1);

  try {
    // Pause via ESP API
    await esp.pauseCampaign(campaign.espCampaignId);

    const message = `Campaign "${campaign.name}" auto-paused: ${bouncePercent}% bounce rate (${totalBounces}/${totalSends} sends). Threshold is ${BOUNCE_RATE_THRESHOLD * 100}%. Check your email list quality before resuming.`;

    // Store notification in the campaign conversation so the agent can inform the user
    await storeBouncePauseNotification(campaign.workspaceId, campaignId, message);

    return { paused: true, totalSends, totalBounces, bounceRate, message };
  } catch (error) {
    logger.warn(`[bounce-guard] Failed to auto-pause campaign ${campaign.name}:`, { error });
    return { paused: false, totalSends, totalBounces, bounceRate };
  }
}

/**
 * Store a system message in the campaign's conversation to notify the user.
 */
async function storeBouncePauseNotification(
  workspaceId: string,
  campaignId: string,
  message: string,
): Promise<void> {
  // Find or create conversation for this campaign
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

  // Store as assistant message so it appears in chat
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: `⚠️ **Auto-Pause Alert**\n\n${message}`,
    },
  });
}
