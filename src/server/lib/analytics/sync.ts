/**
 * Pure function for syncing campaign analytics from any ESP.
 * Uses ESPProvider abstraction — works with Instantly, Smartlead, Lemlist.
 *
 * Extracted from analytics-tools.ts to be reusable by both
 * the chat tool (inline) and the Inngest cron (background).
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { ESPProvider } from "@/server/lib/providers/esp-provider";
import { syncVariantAttribution } from "@/server/lib/analytics/variant-attribution";

export interface SyncCampaignResult {
  campaignId: string;
  sent: number;
  opened: number;
  replied: number;
  bounced: number;
  leadsSynced: number;
  variantsAttributed: number;
}

export async function syncSingleCampaign(
  esp: ESPProvider,
  campaignId: string,
  espCampaignId: string,
  workspaceId: string,
): Promise<SyncCampaignResult> {
  // 1. Overall analytics
  const analytics = await esp.getCampaignAnalytics(espCampaignId);
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      analyticsCache: analytics as unknown as Prisma.InputJsonValue,
      lastSyncedAt: new Date(),
    },
  });

  // 2. Step analytics
  const steps = await esp.getStepAnalytics(espCampaignId);
  for (const s of steps) {
    const openRate = s.sent > 0 ? (s.opened / s.sent) * 100 : 0;
    const replyRate = s.sent > 0 ? (s.replied / s.sent) * 100 : 0;
    await prisma.stepAnalytics.upsert({
      where: { campaignId_step: { campaignId, step: s.step } },
      create: {
        campaignId,
        step: s.step,
        sent: s.sent,
        opened: s.opened,
        replied: s.replied,
        bounced: s.bounced,
        openRate,
        replyRate,
        syncedAt: new Date(),
      },
      update: {
        sent: s.sent,
        opened: s.opened,
        replied: s.replied,
        bounced: s.bounced,
        openRate,
        replyRate,
        syncedAt: new Date(),
      },
    });
  }

  // 3. Lead performance (paginated)
  let cursor: string | undefined;
  let syncedLeads = 0;
  do {
    const page = await esp.getLeadsPerformance(espCampaignId, 100, cursor);
    for (const perf of page.items) {
      const lead = await prisma.lead.findFirst({
        where: { email: perf.email, workspaceId },
        select: { id: true },
      });
      if (!lead) continue;

      await prisma.emailPerformance.upsert({
        where: {
          leadId_campaignId: { leadId: lead.id, campaignId },
        },
        create: {
          leadId: lead.id,
          campaignId,
          email: perf.email,
          openCount: perf.openCount,
          replyCount: perf.replyCount,
          clickCount: perf.clickCount,
          interestStatus: perf.interestStatus,
          lastOpenAt: perf.lastOpenAt ? new Date(perf.lastOpenAt) : null,
          repliedAt: perf.lastReplyAt ? new Date(perf.lastReplyAt) : null,
          syncedAt: new Date(),
        },
        update: {
          openCount: perf.openCount,
          replyCount: perf.replyCount,
          clickCount: perf.clickCount,
          interestStatus: perf.interestStatus,
          lastOpenAt: perf.lastOpenAt ? new Date(perf.lastOpenAt) : null,
          repliedAt: perf.lastReplyAt ? new Date(perf.lastReplyAt) : null,
          syncedAt: new Date(),
        },
      });
      syncedLeads++;
    }
    cursor = page.nextCursor;
    if (cursor) await new Promise((r) => setTimeout(r, 500));
  } while (cursor);

  // 4. Variant attribution
  const variantResult = await syncVariantAttribution(
    esp,
    campaignId,
    espCampaignId,
  );

  return {
    campaignId,
    sent: analytics.sent ?? 0,
    opened: analytics.opened ?? 0,
    replied: analytics.replied ?? 0,
    bounced: analytics.bounced ?? 0,
    leadsSynced: syncedLeads,
    variantsAttributed: variantResult.attributed,
  };
}
