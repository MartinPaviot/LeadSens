/**
 * Reply Guard — Auto-pause campaigns on negative reply spike
 *
 * Research FL-3: "stop immediately if complaints spike" (Enginy AI).
 * Complements bounce-guard.ts. Negative replies (ai_interest < 3)
 * signal spam complaints, wrong targeting, or toxic messaging —
 * continuing sends damages domain reputation and brand.
 *
 * Threshold: ≥3 negative replies within 24h AND ≥20 total sends.
 * Conservative: doesn't trigger on small campaigns or single complaints.
 */

import { prisma } from "@/lib/prisma";
import { getESPProvider } from "@/server/lib/providers";
import { logger } from "@/lib/logger";

// ─── Thresholds ────────────────────────────────────────
export const NEGATIVE_REPLY_THRESHOLD = 3; // minimum negative replies in 24h to trigger
export const NEGATIVE_REPLY_AI_INTEREST_MAX = 3; // aiInterest < 3 = negative (1=not_interested, 2=probably_not)
export const MIN_SENDS_FOR_REPLY_CHECK = 20;

// ─── Types ─────────────────────────────────────────────

export interface NegativeReplyCheckResult {
  /** Whether the campaign was auto-paused */
  paused: boolean;
  /** Total sends tracked for this campaign */
  totalSends: number;
  /** Negative replies in the last 24h */
  negativeReplies24h: number;
  /** Negative reply rate in the 24h window (vs total sends) */
  rate: number;
  /** Human-readable message if paused */
  message?: string;
}

// ─── Core Logic (pure, testable) ───────────────────────

/**
 * Determine if a campaign should be paused based on negative reply volume.
 * Pure function — no side effects.
 *
 * Uses absolute count (≥3) rather than rate because negative replies
 * are inherently low-frequency events. Even 3 complaints in 24h from
 * a 500-send campaign (0.6%) signals a messaging problem worth investigating.
 */
export function shouldPauseOnNegativeReplies(
  totalSends: number,
  negativeReplyCount24h: number,
): { shouldPause: boolean; rate: number } {
  if (totalSends < MIN_SENDS_FOR_REPLY_CHECK) {
    return { shouldPause: false, rate: totalSends > 0 ? negativeReplyCount24h / totalSends : 0 };
  }

  const rate = negativeReplyCount24h / totalSends;

  return {
    shouldPause: negativeReplyCount24h >= NEGATIVE_REPLY_THRESHOLD,
    rate,
  };
}

// ─── DB + API Integration ──────────────────────────────

/**
 * Check negative reply rate for a campaign and auto-pause if threshold exceeded.
 * Called from the webhook handler after each reply_received event
 * when ai_interest_value is present and < NEGATIVE_REPLY_AI_INTEREST_MAX.
 *
 * @param campaignId - Internal campaign ID (not Instantly ID)
 * @returns NegativeReplyCheckResult with pause status and stats
 */
export async function checkAndPauseOnNegativeReplies(
  campaignId: string,
): Promise<NegativeReplyCheckResult> {
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
    return { paused: false, totalSends: 0, negativeReplies24h: 0, rate: 0 };
  }

  // Already paused or not active — skip
  if (campaign.status !== "PUSHED" && campaign.status !== "ACTIVE") {
    return { paused: false, totalSends: 0, negativeReplies24h: 0, rate: 0 };
  }

  // Count total sends
  const leadsPushed = await prisma.lead.count({
    where: {
      campaignId,
      status: {
        in: [
          "PUSHED", "SENT", "REPLIED", "INTERESTED",
          "NOT_INTERESTED", "MEETING_BOOKED", "BOUNCED", "UNSUBSCRIBED",
        ],
      },
    },
  });

  // Count negative replies in the last 24h
  // Uses Reply table (has aiInterest per reply) via ReplyThread (has campaignId)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const negativeReplies24h = await prisma.reply.count({
    where: {
      thread: { campaignId },
      direction: "INBOUND",
      aiInterest: { lt: NEGATIVE_REPLY_AI_INTEREST_MAX },
      sentAt: { gte: twentyFourHoursAgo },
    },
  });

  const { shouldPause, rate } = shouldPauseOnNegativeReplies(leadsPushed, negativeReplies24h);

  if (!shouldPause) {
    return { paused: false, totalSends: leadsPushed, negativeReplies24h, rate };
  }

  // Get ESP provider to pause campaign
  const esp = await getESPProvider(campaign.workspaceId);

  if (!esp) {
    logger.warn(`[reply-guard] Cannot auto-pause campaign ${campaign.name}: no active ESP integration`);
    return { paused: false, totalSends: leadsPushed, negativeReplies24h, rate };
  }

  const ratePercent = (rate * 100).toFixed(1);

  try {
    await esp.pauseCampaign(campaign.espCampaignId);

    const message = `Campaign "${campaign.name}" auto-paused: ${negativeReplies24h} negative replies in the last 24h (${ratePercent}% of ${leadsPushed} sends). This indicates messaging issues or wrong targeting. Review your email content, ICP definition, and reply feedback before resuming.`;

    await storeReplyGuardNotification(campaign.workspaceId, campaignId, message);

    return { paused: true, totalSends: leadsPushed, negativeReplies24h, rate, message };
  } catch (error) {
    logger.warn(`[reply-guard] Failed to auto-pause campaign ${campaign.name}:`, { error });
    return { paused: false, totalSends: leadsPushed, negativeReplies24h, rate };
  }
}

/**
 * Store a system message in the campaign's conversation to notify the user.
 */
async function storeReplyGuardNotification(
  workspaceId: string,
  campaignId: string,
  message: string,
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
      content: `⚠️ **Negative Reply Alert**\n\n${message}`,
    },
  });
}
