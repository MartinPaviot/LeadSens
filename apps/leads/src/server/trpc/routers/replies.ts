import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { router, protectedProcedure } from "../trpc";

// ─── Helpers ────────────────────────────────────────────

function threadStatusToCategory(status: string, isAutoReply: boolean): string {
  if (isAutoReply) return "auto_reply";
  switch (status) {
    case "INTERESTED": return "interested";
    case "NOT_INTERESTED": return "not_interested";
    case "MEETING_BOOKED": return "interested";
    default: return "unclassified";
  }
}

function interestToSentiment(score: number | null): string {
  if (score == null) return "neutral";
  if (score >= 7) return "positive";
  if (score >= 4) return "neutral";
  return "negative";
}

// ─── Router ─────────────────────────────────────────────

export const repliesRouter = router({
  getAll: protectedProcedure
    .input(
      z.object({
        status: z.string().optional(),
        category: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Fetch reply threads with their latest inbound reply
      const where: Record<string, unknown> = {
        workspaceId: ctx.workspaceId,
      };

      // Map category filter to thread status
      if (input.category === "interested") {
        where.status = { in: ["INTERESTED", "MEETING_BOOKED"] };
      } else if (input.category === "not_interested") {
        where.status = "NOT_INTERESTED";
      } else if (input.category === "auto_reply") {
        // Auto-replies are OPEN threads where the last reply is auto
      } else if (input.status) {
        where.status = input.status;
      }

      const threads = await prisma.replyThread.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: {
          lead: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              company: true,
              jobTitle: true,
              email: true,
              industry: true,
              icpScore: true,
              icpBreakdown: true,
              linkedinUrl: true,
            },
          },
          campaign: {
            select: {
              id: true,
              name: true,
            },
          },
          replies: {
            orderBy: { sentAt: "desc" },
            take: 1,
            where: { direction: "INBOUND" },
          },
        },
      });

      const hasMore = threads.length > input.limit;
      const items = hasMore ? threads.slice(0, input.limit) : threads;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      // Counts by status
      const [allCount, interestedCount, notInterestedCount, openCount, meetingCount] =
        await Promise.all([
          prisma.replyThread.count({ where: { workspaceId: ctx.workspaceId } }),
          prisma.replyThread.count({ where: { workspaceId: ctx.workspaceId, status: "INTERESTED" } }),
          prisma.replyThread.count({ where: { workspaceId: ctx.workspaceId, status: "NOT_INTERESTED" } }),
          prisma.replyThread.count({ where: { workspaceId: ctx.workspaceId, status: "OPEN" } }),
          prisma.replyThread.count({ where: { workspaceId: ctx.workspaceId, status: "MEETING_BOOKED" } }),
        ]);

      // Transform threads into reply cards
      const replyCards = items.map((thread) => {
        const lastReply = thread.replies[0];
        const isAuto = lastReply?.isAutoReply ?? false;
        const category = threadStatusToCategory(thread.status, isAuto);
        const sentiment = interestToSentiment(thread.interestScore);

        return {
          id: thread.id,
          leadId: thread.leadId,
          campaignId: thread.campaignId,
          status: thread.status,
          category,
          sentiment,
          interestScore: thread.interestScore,
          classifiedAt: thread.classifiedAt,

          // Lead info
          leadName: [thread.lead.firstName, thread.lead.lastName].filter(Boolean).join(" ") || thread.lead.email,
          leadTitle: thread.lead.jobTitle,
          leadCompany: thread.lead.company,
          leadEmail: thread.lead.email,
          leadIndustry: thread.lead.industry,
          leadScore: thread.lead.icpScore,

          // Campaign info
          campaignName: thread.campaign.name,

          // Reply content
          subject: thread.subject ?? lastReply?.subject ?? "(no subject)",
          bodyPreview: lastReply?.preview ?? lastReply?.body?.slice(0, 200) ?? "",
          body: lastReply?.body ?? "",
          isAutoReply: isAuto,
          receivedAt: lastReply?.sentAt ?? thread.updatedAt,

          // AI summary (from interestScore + status)
          aiSummary: isAuto
            ? "Automated reply"
            : thread.interestScore != null && thread.interestScore >= 7
              ? "Shows strong interest"
              : thread.interestScore != null && thread.interestScore >= 4
                ? "Asking questions, exploring options"
                : thread.status === "NOT_INTERESTED"
                  ? "Not interested or asked to be removed"
                  : null,

          updatedAt: thread.updatedAt,
        };
      });

      return {
        replies: replyCards,
        nextCursor,
        counts: {
          all: allCount,
          interested: interestedCount + meetingCount,
          not_interested: notInterestedCount,
          open: openCount,
          unread: openCount, // OPEN threads are effectively "unread"
        },
      };
    }),

  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await prisma.replyThread.count({
      where: { workspaceId: ctx.workspaceId, status: "OPEN" },
    });
    return { count };
  }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        threadId: z.string(),
        status: z.enum(["OPEN", "INTERESTED", "NOT_INTERESTED", "MEETING_BOOKED", "CLOSED"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.replyThread.update({
        where: { id: input.threadId, workspaceId: ctx.workspaceId },
        data: { status: input.status },
      });
      return { success: true };
    }),

  archive: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.replyThread.update({
        where: { id: input.threadId, workspaceId: ctx.workspaceId },
        data: { status: "CLOSED" },
      });
      return { success: true };
    }),

  archiveBulk: protectedProcedure
    .input(z.object({ threadIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      await prisma.replyThread.updateMany({
        where: { id: { in: input.threadIds }, workspaceId: ctx.workspaceId },
        data: { status: "CLOSED" },
      });
      return { success: true, count: input.threadIds.length };
    }),
});
