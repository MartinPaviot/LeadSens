/**
 * Pure function for syncing campaign analytics from any ESP.
 * Uses ESPProvider abstraction — works with Instantly, Smartlead, Lemlist.
 *
 * Extracted from analytics-tools.ts to be reusable by both
 * the chat tool (inline) and the Inngest cron (background).
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@leadsens/db";
import type { ESPProvider } from "@/server/lib/providers/esp-provider";
import { syncVariantAttribution } from "@/server/lib/analytics/variant-attribution";
import { cacheInvalidatePattern } from "@/lib/cache";

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

  // 2. Step analytics (batched in a single transaction)
  const steps = await esp.getStepAnalytics(espCampaignId);
  if (steps.length > 0) {
    await prisma.$transaction(
      steps.map((s) => {
        const openRate = s.sent > 0 ? (s.opened / s.sent) * 100 : 0;
        const replyRate = s.sent > 0 ? (s.replied / s.sent) * 100 : 0;
        return prisma.stepAnalytics.upsert({
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
      }),
    );
  }

  // 3. Lead performance (paginated, batched — 2 queries per page instead of N)
  let cursor: string | undefined;
  let syncedLeads = 0;
  do {
    const page = await esp.getLeadsPerformance(espCampaignId, 100, cursor);

    if (page.items.length > 0) {
      // Batch lookup: 1 findMany instead of N findFirst
      const emails = page.items.map((p) => p.email);
      const leads = await prisma.lead.findMany({
        where: { email: { in: emails }, workspaceId },
        select: { id: true, email: true },
      });
      const emailToLeadId = new Map(leads.map((l) => [l.email, l.id]));

      // Batch upsert in a single transaction
      const upserts = page.items
        .filter((perf) => emailToLeadId.has(perf.email))
        .map((perf) => {
          const leadId = emailToLeadId.get(perf.email)!;
          return prisma.emailPerformance.upsert({
            where: { leadId_campaignId: { leadId, campaignId } },
            create: {
              leadId,
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
        });

      if (upserts.length > 0) {
        await prisma.$transaction(upserts);
        syncedLeads += upserts.length;
      }
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

  // 5. Invalidate correlator cache — performance data has changed
  await cacheInvalidatePattern(`corr:*:${workspaceId}:*`);

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
