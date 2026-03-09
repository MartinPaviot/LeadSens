import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { decrypt } from "@/lib/encryption";
import {
  getCampaignAnalytics,
  getCampaignStepAnalytics,
  getLeadsWithPerformance,
} from "@/server/lib/connectors/instantly";
import { createWorker } from "./factory";

interface AnalyticsSyncJobData {
  workspaceId: string;
  campaignId: string; // Our campaign ID
  instantlyCampaignId: string; // Instantly campaign ID
}

export const analyticsSyncWorker = createWorker(
  "analytics:sync",
  async (job: { data: AnalyticsSyncJobData }) => {
    const { workspaceId, campaignId, instantlyCampaignId } = job.data;

    // Get Instantly API key for workspace
    const integration = await prisma.integration.findUnique({
      where: { workspaceId_type: { workspaceId, type: "INSTANTLY" } },
    });
    if (!integration?.apiKey || integration.status !== "ACTIVE") return;
    const apiKey = decrypt(integration.apiKey);

    // 1. Fetch & cache overall analytics
    const analytics = await getCampaignAnalytics(apiKey, instantlyCampaignId);
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        analyticsCache: analytics as unknown as Prisma.InputJsonValue,
        lastSyncedAt: new Date(),
      },
    });

    // 2. Fetch & upsert step analytics
    const stepData = await getCampaignStepAnalytics(apiKey, instantlyCampaignId);
    for (const s of stepData.steps) {
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

    // 3. Paginate leads with performance data
    let startingAfter: string | undefined;
    do {
      const page = await getLeadsWithPerformance(apiKey, instantlyCampaignId, 100, startingAfter);

      for (const perf of page.items) {
        // Find matching local lead by email
        const lead = await prisma.lead.findFirst({
          where: { email: perf.email, workspaceId },
          select: { id: true },
        });
        if (!lead) continue;

        await prisma.emailPerformance.upsert({
          where: { leadId_campaignId: { leadId: lead.id, campaignId } },
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
      }

      startingAfter = page.nextStartingAfter;

      // Rate limit: 500ms between pages
      if (startingAfter) {
        await new Promise((r) => setTimeout(r, 500));
      }
    } while (startingAfter);
  },
  { concurrency: 2 },
);
