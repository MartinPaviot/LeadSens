import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { router, protectedProcedure } from "../trpc";

export const campaignRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return prisma.campaign.findMany({
      where: { workspaceId: ctx.workspaceId! },
      orderBy: { createdAt: "desc" },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return prisma.campaign.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId! },
      });
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
