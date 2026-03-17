import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { syncSingleCampaign } from "@/server/lib/analytics/sync";
import { getESPProvider } from "@/server/lib/providers";
import { getWorkspaceInsights, getCampaignReport } from "@/server/lib/analytics/insights";
import {
  getReplyRateByIcpScore,
  getReplyRateByJobTitle,
  getReplyRateByCompanySize,
} from "@/server/lib/analytics/correlator";
import type { ToolDefinition, ToolContext } from "./types";

export function createAnalyticsTools(ctx: ToolContext): Record<string, ToolDefinition> {
  return {
    sync_campaign_analytics: {
      name: "sync_campaign_analytics",
      description: "Sync latest performance data (opens, replies, bounces) from the connected ESP for a campaign. Call this before generating reports to ensure fresh data.",
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
        if (!campaign.espCampaignId) return { error: "Campaign has no ESP campaign ID." };

        // Get ESP provider (supports Instantly, Smartlead, Lemlist)
        const esp = await getESPProvider(ctx.workspaceId);
        if (!esp) {
          return { error: "No ESP connected. Connect Instantly, Smartlead, or Lemlist in Settings → Integrations." };
        }

        ctx.onStatus?.("Syncing campaign analytics...");

        const result = await syncSingleCampaign(
          esp,
          campaign.id,
          campaign.espCampaignId,
          ctx.workspaceId,
        );

        return {
          synced: true,
          campaignId: campaign.id,
          campaignName: campaign.name,
          lastSyncedAt: new Date().toISOString(),
          summary: {
            sent: result.sent,
            opened: result.opened,
            replied: result.replied,
            bounced: result.bounced,
            leadssynced: result.leadsSynced,
            variantsAttributed: result.variantsAttributed,
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
            variantBreakdown: report.variantBreakdown,
            topLeads: report.topLeads,
            insights: report.insights,
            benchmarkContext: report.benchmarkContext,
          },
        };
      },
    },

    performance_insights: {
      name: "performance_insights",
      description: "Analyze cross-campaign performance patterns: which signals, frameworks, enrichment depths, industries, and word counts drive the best reply rates.",
      parameters: z.object({
        dimension: z.enum(["signal_type", "framework", "quality_score", "enrichment_depth", "industry", "word_count", "subject_variant"])
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

    icp_performance_analysis: {
      name: "icp_performance_analysis",
      description:
        "Analyze which ICP segments perform best based on real reply data. " +
        "Shows reply rates by ICP score bucket, job title, and company size. " +
        "Use this to validate your ICP against actual campaign results.",
      parameters: z.object({
        campaign_id: z.string().optional().describe("Specific campaign to analyze, or omit for all campaigns"),
      }),
      async execute(args) {
        const [byScore, byTitle, bySize] = await Promise.all([
          getReplyRateByIcpScore(ctx.workspaceId, args.campaign_id),
          getReplyRateByJobTitle(ctx.workspaceId, args.campaign_id),
          getReplyRateByCompanySize(ctx.workspaceId, args.campaign_id),
        ]);

        if (byScore.length === 0 && byTitle.length === 0 && bySize.length === 0) {
          return {
            message: "Not enough performance data yet. Need at least 5 sent emails with tracking data per segment. Sync campaign analytics first.",
          };
        }

        // Compute ideal ICP profile = segments with highest reply rate + sufficient volume (>= 20)
        const idealProfile: string[] = [];
        const negativeProfile: string[] = [];
        const MIN_VOLUME = 20;

        for (const row of byTitle) {
          if (row.sent >= MIN_VOLUME && row.replyRate >= 10) {
            idealProfile.push(`${row.dimension} (${row.replyRate}% reply rate, ${row.sent} sent)`);
          }
          if (row.sent >= MIN_VOLUME && row.replyRate === 0) {
            negativeProfile.push(`${row.dimension} (0% reply rate, ${row.sent} sent)`);
          }
        }

        for (const row of bySize) {
          if (row.sent >= MIN_VOLUME && row.replyRate >= 10) {
            idealProfile.push(`Company size ${row.dimension} (${row.replyRate}% reply rate, ${row.sent} sent)`);
          }
          if (row.sent >= MIN_VOLUME && row.replyRate === 0) {
            negativeProfile.push(`Company size ${row.dimension} (0% reply rate, ${row.sent} sent)`);
          }
        }

        const recommendations: string[] = [];

        // Score threshold recommendation
        const highScoreBucket = byScore.find((r) => r.dimension === "9-10");
        const midScoreBucket = byScore.find((r) => r.dimension === "7-8");
        if (highScoreBucket && midScoreBucket) {
          if (highScoreBucket.replyRate > midScoreBucket.replyRate * 1.5) {
            recommendations.push(`Focus on score 9-10 leads (${highScoreBucket.replyRate}% vs ${midScoreBucket.replyRate}% reply rate). Consider raising the scoring threshold.`);
          } else if (midScoreBucket.replyRate >= highScoreBucket.replyRate) {
            recommendations.push(`Score 7-8 leads perform as well as 9-10 (${midScoreBucket.replyRate}% vs ${highScoreBucket.replyRate}%). Current threshold is appropriate.`);
          }
        }

        if (negativeProfile.length > 0) {
          recommendations.push(`Consider excluding these segments from future campaigns (0% reply rate with significant volume): ${negativeProfile.slice(0, 3).join("; ")}`);
        }

        if (idealProfile.length > 0) {
          recommendations.push(`Double down on these high-performing segments: ${idealProfile.slice(0, 3).join("; ")}`);
        }

        return {
          by_icp_score: byScore,
          by_job_title: byTitle,
          by_company_size: bySize,
          ideal_icp_segments: idealProfile,
          negative_icp_segments: negativeProfile,
          recommendations,
        };
      },
    },
  };
}
