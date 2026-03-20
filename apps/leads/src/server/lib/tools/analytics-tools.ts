import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { syncSingleCampaign } from "@/server/lib/analytics/sync";
import { getESPProvider } from "@/server/lib/providers";
import { getWorkspaceInsights, getCampaignReport } from "@/server/lib/analytics/insights";
import {
  getReplyRateByIcpScore,
  getReplyRateByJobTitle,
  getReplyRateByCompanySize,
  getReplyRateBySubjectPattern,
} from "@/server/lib/analytics/correlator";
import { getWinningEmailPatterns, getWinningSubjects } from "@/server/lib/email/style-learner";
import type { ToolDefinition, ToolContext } from "./types";

export function createAnalyticsTools(ctx: ToolContext): Record<string, ToolDefinition> {
  return {
    show_tam: {
      name: "show_tam",
      description:
        "Show the user's TAM (Total Addressable Market) with scored sample leads. " +
        "Call this when the user says 'show my TAM', 'my market', 'show market', or asks about their addressable market.",
      parameters: z.object({}),
      async execute() {
        const workspace = await prisma.workspace.findUniqueOrThrow({
          where: { id: ctx.workspaceId },
          select: { tamResult: true },
        });

        if (!workspace.tamResult) {
          return { error: "No TAM data yet. Complete onboarding step 2 (enter your website URL) to build your TAM." };
        }

        const tam = workspace.tamResult as Record<string, unknown>;
        const counts = tam.counts as { total?: number } | undefined;
        const leads = tam.leads as unknown[] | undefined;
        const burningEstimate = (tam.burningEstimate as number) ?? 0;
        const total = counts?.total ?? 0;

        return {
          __component: "rich-lead-table",
          props: {
            title: `Your TAM — ${total.toLocaleString()} accounts`,
            leads: (leads ?? []).slice(0, 20),
            mode: "tam",
          },
          summary: `TAM: ${total.toLocaleString()} accounts, ~${burningEstimate.toLocaleString()} Burning`,
          total,
          burningEstimate,
        };
      },
    },

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

    learning_summary: {
      name: "learning_summary",
      description:
        "Show what the system has learned from past campaigns — winning email patterns, " +
        "subject line performance, style corrections, A/B test winners. " +
        "Use this proactively when a user returns or before drafting a new campaign to show that the system improves over time.",
      parameters: z.object({}),
      async execute() {
        ctx.onStatus?.("Checking what I've learned...");

        const [
          winningPatterns,
          winningSubjects,
          styleCount,
          subjectPatternStats,
          abResults,
          totalCampaigns,
          totalLeads,
        ] = await Promise.all([
          getWinningEmailPatterns(ctx.workspaceId),
          getWinningSubjects(ctx.workspaceId),
          prisma.agentFeedback.count({
            where: { workspaceId: ctx.workspaceId, type: "USER_EDIT" },
          }),
          getReplyRateBySubjectPattern(ctx.workspaceId),
          // Count A/B test notifications (variant paused)
          prisma.message.count({
            where: {
              content: { contains: "A/B Test Result" },
              conversation: { workspaceId: ctx.workspaceId },
            },
          }),
          prisma.campaign.count({
            where: { workspaceId: ctx.workspaceId, status: { in: ["PUSHED", "ACTIVE"] } },
          }),
          prisma.lead.count({
            where: { workspaceId: ctx.workspaceId },
          }),
        ]);

        // Build the summary
        const learnings: string[] = [];

        if (totalCampaigns === 0 && totalLeads === 0) {
          return {
            message: "No campaigns or leads yet — I'll start learning from your first campaign's results.",
            learnings: [],
            hasData: false,
          };
        }

        // Winning email patterns
        if (winningPatterns.length > 0) {
          for (const p of winningPatterns) {
            learnings.push(`Winning pattern: ${p.summary} (${p.replyRate.toFixed(1)}% reply rate)`);
          }
        }

        // Winning subjects
        if (winningSubjects.length > 0) {
          const topSubjects = winningSubjects.slice(0, 3);
          for (const s of topSubjects) {
            learnings.push(`Proven subject: "${s.subject}" (${s.replies} ${s.replies === 1 ? "reply" : "replies"}, ${s.pattern} pattern)`);
          }
        }

        // Subject pattern performance
        const patternsWithData = subjectPatternStats.filter((p) => p.sent >= 10);
        if (patternsWithData.length >= 2) {
          const sorted = [...patternsWithData].sort((a, b) => {
            const rateA = a.sent > 0 ? a.replied / a.sent : 0;
            const rateB = b.sent > 0 ? b.replied / b.sent : 0;
            return rateB - rateA;
          });
          const best = sorted[0];
          const bestRate = best.sent > 0 ? ((best.replied / best.sent) * 100).toFixed(1) : "0";
          learnings.push(`Best subject pattern: ${best.name} (${bestRate}% reply rate, ${best.sent} sent)`);
        }

        // Style corrections
        if (styleCount > 0) {
          learnings.push(`${styleCount} style correction${styleCount !== 1 ? "s" : ""} captured — future emails will match your writing preferences`);
        }

        // A/B test results
        if (abResults > 0) {
          learnings.push(`${abResults} A/B test${abResults !== 1 ? "s" : ""} completed — losing variants auto-paused`);
        }

        if (learnings.length === 0) {
          return {
            message: `I have ${totalCampaigns} campaign${totalCampaigns !== 1 ? "s" : ""} and ${totalLeads} leads tracked, but not enough reply data yet to identify patterns. Once you get 20+ replies, I'll start surfacing winning patterns.`,
            learnings: [],
            hasData: false,
          };
        }

        return {
          message: `Here's what I've learned from your campaigns:`,
          learnings,
          stats: {
            campaigns: totalCampaigns,
            leads: totalLeads,
            styleCorrections: styleCount,
            winningPatterns: winningPatterns.length,
            winningSubjects: winningSubjects.length,
            abTestsCompleted: abResults,
          },
          hasData: true,
        };
      },
    },
  };
}
