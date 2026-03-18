import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { ToolContext } from "./types";

/**
 * Resolves the campaign ID for the current context.
 * Priority: explicit param > conversation link (DB).
 *
 * The conversation ↔ campaign link is set by source_leads
 * when it creates a campaign, so it survives across chat turns.
 *
 * We intentionally do NOT fall back to "most recent campaign in workspace"
 * because that can silently operate on a campaign from a different conversation,
 * causing tools to enrich/draft against stale data.
 */
export async function resolveCampaignId(
  ctx: ToolContext,
  explicitCampaignId?: string,
): Promise<string | null> {
  // 1. Explicit (from tool params or same-session chaining)
  if (explicitCampaignId) return explicitCampaignId;

  // 2. Conversation link (survives across chat turns)
  if (ctx.conversationId) {
    const conv = await prisma.conversation.findUnique({
      where: { id: ctx.conversationId },
      select: { campaignId: true },
    });
    if (conv?.campaignId) return conv.campaignId;
  }

  // 3. No campaign found — return null so caller can handle gracefully
  logger.warn("resolveCampaignId: no campaign linked to conversation", {
    conversationId: ctx.conversationId,
    workspaceId: ctx.workspaceId,
  });
  return null;
}
