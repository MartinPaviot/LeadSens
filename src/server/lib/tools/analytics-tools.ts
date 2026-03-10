import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { decrypt } from "@/lib/encryption";
import {
  getCampaignAnalytics,
  getCampaignStepAnalytics,
  getLeadsWithPerformance,
} from "@/server/lib/connectors/instantly";
import { getWorkspaceInsights, getCampaignReport } from "@/server/lib/analytics/insights";
import { syncVariantAttribution } from "@/server/lib/analytics/variant-attribution";
import type { ToolDefinition, ToolContext } from "./types";

export function createAnalyticsTools(ctx: ToolContext): Record<string, ToolDefinition> {
  return {
    sync_campaign_analytics: {
      name: "sync_campaign_analytics",
      description: "Sync latest performance data (opens, replies, bounces) from Instantly for a campaign. Call this before generating reports to ensure fresh data.",
      parameters: z.object({
        campaign_id: z.string().optional().describe("Campaign ID. If omitted, uses the most recent PUSHED/ACTIVE campaign."),
      }),
      async execute(args) {
        // Resolve campaign
        const campaign = args.campaign_id
          ? await prisma.campaign.findFirst({
              where: { id: args.campaign_id, workspaceId: ctx.workspaceId },
            })
          : await prisma.campaign.findFirst({
              where: {
                workspaceId: ctx.workspaceId,
                status: { in: ["PUSHED", "ACTIVE"] },
              },
              orderBy: { updatedAt: "desc" },
            });

        if (!campaign) return { error: "No campaign found to sync." };
        if (!campaign.instantlyCampaignId) return { error: "Campaign has no Instantly campaign ID." };

        // Get API key
        const integration = await prisma.integration.findUnique({
          where: { workspaceId_type: { workspaceId: ctx.workspaceId, type: "INSTANTLY" } },
        });
        if (!integration?.apiKey || integration.status !== "ACTIVE") {
          return { error: "Instantly not connected." };
        }
        const apiKey = decrypt(integration.apiKey);

        ctx.onStatus?.("Syncing campaign analytics...");

        // 1. Overall analytics
        const analytics = await getCampaignAnalytics(apiKey, campaign.instantlyCampaignId);
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { analyticsCache: analytics as unknown as Prisma.InputJsonValue, lastSyncedAt: new Date() },
        });

        // 2. Step analytics
        const stepData = await getCampaignStepAnalytics(apiKey, campaign.instantlyCampaignId);
        for (const s of stepData.steps) {
          const openRate = s.sent > 0 ? (s.opened / s.sent) * 100 : 0;
          const replyRate = s.sent > 0 ? (s.replied / s.sent) * 100 : 0;
          await prisma.stepAnalytics.upsert({
            where: { campaignId_step: { campaignId: campaign.id, step: s.step } },
            create: {
              campaignId: campaign.id, step: s.step,
              sent: s.sent, opened: s.opened, replied: s.replied, bounced: s.bounced,
              openRate, replyRate, syncedAt: new Date(),
            },
            update: {
              sent: s.sent, opened: s.opened, replied: s.replied, bounced: s.bounced,
              openRate, replyRate, syncedAt: new Date(),
            },
          });
        }

        // 3. Lead performance (paginated)
        let startingAfter: string | undefined;
        let syncedLeads = 0;
        do {
          const page = await getLeadsWithPerformance(apiKey, campaign.instantlyCampaignId, 100, startingAfter);
          for (const perf of page.items) {
            const lead = await prisma.lead.findFirst({
              where: { email: perf.email, workspaceId: ctx.workspaceId },
              select: { id: true },
            });
            if (!lead) continue;

            await prisma.emailPerformance.upsert({
              where: { leadId_campaignId: { leadId: lead.id, campaignId: campaign.id } },
              create: {
                leadId: lead.id, campaignId: campaign.id, email: perf.email,
                openCount: perf.openCount, replyCount: perf.replyCount, clickCount: perf.clickCount,
                interestStatus: perf.interestStatus,
                lastOpenAt: perf.lastOpenAt ? new Date(perf.lastOpenAt) : null,
                repliedAt: perf.lastReplyAt ? new Date(perf.lastReplyAt) : null,
                syncedAt: new Date(),
              },
              update: {
                openCount: perf.openCount, replyCount: perf.replyCount, clickCount: perf.clickCount,
                interestStatus: perf.interestStatus,
                lastOpenAt: perf.lastOpenAt ? new Date(perf.lastOpenAt) : null,
                repliedAt: perf.lastReplyAt ? new Date(perf.lastReplyAt) : null,
                syncedAt: new Date(),
              },
            });
            syncedLeads++;
          }
          startingAfter = page.nextStartingAfter;
          if (startingAfter) await new Promise((r) => setTimeout(r, 500));
        } while (startingAfter);

        // 4. Variant attribution — match sent email subjects to A/B variants
        const variantResult = await syncVariantAttribution(
          apiKey,
          campaign.id,
          campaign.instantlyCampaignId,
        );

        return {
          synced: true,
          campaignId: campaign.id,
          campaignName: campaign.name,
          lastSyncedAt: new Date().toISOString(),
          summary: {
            sent: analytics.emails_sent,
            opened: analytics.emails_read,
            replied: analytics.replied,
            bounced: analytics.bounced,
            leadssynced: syncedLeads,
            variantsAttributed: variantResult.attributed,
          },
        };
      },
    },

    campaign_performance_report: {
      name: "campaign_performance_report",
      description: "Generate a detailed performance report for a campaign: open/reply rates, step breakdown, top leads, signal effectiveness, and actionable insights.",
      parameters: z.object({
        campaign_id: z.string().optional().describe("Campaign ID. If omitted, uses the most recent PUSHED/ACTIVE campaign."),
      }),
      async execute(args) {
        const campaign = args.campaign_id
          ? await prisma.campaign.findFirst({
              where: { id: args.campaign_id, workspaceId: ctx.workspaceId },
            })
          : await prisma.campaign.findFirst({
              where: {
                workspaceId: ctx.workspaceId,
                status: { in: ["PUSHED", "ACTIVE"] },
              },
              orderBy: { updatedAt: "desc" },
            });

        if (!campaign) return { error: "No campaign found." };

        const report = await getCampaignReport(ctx.workspaceId, campaign.id);

        // Return as inline analytics card + raw data for the LLM to comment on
        return {
          campaignId: campaign.id,
          campaignName: campaign.name,
          ...report,
          __component: "analytics-report",
          props: {
            campaignName: campaign.name,
            overview: report.overview,
            stepBreakdown: report.stepBreakdown,
            topLeads: report.topLeads,
            insights: report.insights,
          },
        };
      },
    },

    performance_insights: {
      name: "performance_insights",
      description: "Analyze cross-campaign performance patterns: which signals, frameworks, enrichment depths, industries, and word counts drive the best reply rates.",
      parameters: z.object({
        dimension: z.enum(["signal_type", "framework", "quality_score", "enrichment_depth", "industry", "word_count"])
          .optional()
          .describe("Focus on a specific dimension, or omit for all insights."),
      }),
      async execute(args) {
        const insights = await getWorkspaceInsights(ctx.workspaceId);

        if (args.dimension) {
          const filtered = insights.filter((i) => i.dimension === args.dimension);
          if (filtered.length === 0) {
            return { message: `Not enough data for "${args.dimension}" insights yet. Need at least 20 emails with performance data.` };
          }
          return { insights: filtered };
        }

        if (insights.length === 0) {
          return { message: "Not enough performance data yet. Sync campaign analytics first, then try again once you have 20+ emails with tracked opens/replies." };
        }

        return { insights };
      },
    },
  };
}
