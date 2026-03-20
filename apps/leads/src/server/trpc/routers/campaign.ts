import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { router, protectedProcedure } from "../trpc";
import { getWinningEmailPatterns, getWinningSubjects } from "@/server/lib/email/style-learner";

export const campaignRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return prisma.campaign.findMany({
      where: { workspaceId: ctx.workspaceId! },
      orderBy: { createdAt: "desc" },
    });
  }),

  listWithAnalytics: protectedProcedure.query(async ({ ctx }) => {
    const campaigns = await prisma.campaign.findMany({
      where: { workspaceId: ctx.workspaceId! },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        icpDescription: true,
        leadsTotal: true,
        leadsScored: true,
        leadsEnriched: true,
        leadsDrafted: true,
        leadsPushed: true,
        leadsSkipped: true,
        createdAt: true,
        updatedAt: true,
        analyticsCache: true,
      },
    });
    return campaigns;
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return prisma.campaign.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId! },
      });
    }),

  getDetail: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await prisma.campaign.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId! },
        select: {
          id: true,
          name: true,
          status: true,
          icpDescription: true,
          leadsTotal: true,
          leadsScored: true,
          leadsEnriched: true,
          leadsDrafted: true,
          leadsPushed: true,
          leadsSkipped: true,
          createdAt: true,
          updatedAt: true,
          analyticsCache: true,
          stepAnalytics: {
            orderBy: { step: "asc" },
          },
        },
      });
      if (!campaign) return null;

      const meetingsBooked = await prisma.replyThread.count({
        where: {
          campaignId: input.id,
          workspaceId: ctx.workspaceId!,
          status: "MEETING_BOOKED",
        },
      });

      return { ...campaign, meetingsBooked };
    }),

  getLearningStats: protectedProcedure.query(async ({ ctx }) => {
    const workspaceId = ctx.workspaceId!;

    const [
      winningPatterns,
      winningSubjects,
      styleCorrectionsCount,
      campaigns,
    ] = await Promise.all([
      getWinningEmailPatterns(workspaceId),
      getWinningSubjects(workspaceId),
      prisma.agentFeedback.count({
        where: { workspaceId, type: "USER_EDIT" },
      }),
      prisma.campaign.findMany({
        where: { workspaceId },
        select: {
          id: true,
          name: true,
          analyticsCache: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Count A/B test completions (campaigns with variant performance data)
    const abTestsCompleted = await prisma.stepAnalytics.count({
      where: {
        campaign: { workspaceId },
        sent: { gt: 100 },
      },
    });

    // Build reply rate trend (campaign-over-campaign)
    const replyRateTrend = campaigns.map((c) => {
      const cache = c.analyticsCache as { sent?: number; replied?: number } | null;
      const sent = cache?.sent ?? 0;
      const replied = cache?.replied ?? 0;
      const replyRate = sent > 0 ? (replied / sent) * 100 : 0;
      return { name: c.name, replyRate: Math.round(replyRate * 10) / 10 };
    });

    const hasData =
      campaigns.length >= 2 &&
      (winningPatterns.length > 0 || styleCorrectionsCount > 0 || abTestsCompleted > 0);

    return {
      hasData,
      winningPatternsCount: winningPatterns.length,
      styleCorrectionsCount,
      abTestsCompleted,
      winningSubjectsCount: winningSubjects.length,
      replyRateTrend,
      campaignCount: campaigns.length,
    };
  }),

  getLeads: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        status: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const leads = await prisma.lead.findMany({
        where: {
          workspaceId: ctx.workspaceId!,
          campaignId: input.campaignId,
          ...(input.status && { status: input.status as "SOURCED" }),
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
      });

      let nextCursor: string | undefined;
      if (leads.length > input.limit) {
        const next = leads.pop();
        nextCursor = next?.id;
      }

      return { leads, nextCursor };
    }),
});
