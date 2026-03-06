import { prisma } from "@/lib/prisma";
import type { ToolContext } from "./types";

/**
 * Resolves the campaign ID for the current context.
 * Priority: explicit param > conversation link (DB) > most recent campaign.
 *
 * The conversation ↔ campaign link is set by instantly_source_leads
 * when it creates a campaign, so it survives across chat turns.
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

  // 3. Fallback: most recent campaign in workspace
  const recent = await prisma.campaign.findFirst({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return recent?.id ?? null;
}
