import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { router, protectedProcedure } from "../trpc";

export const conversationRouter = router({
  create: protectedProcedure
    .input(z.object({ title: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return prisma.conversation.create({
        data: {
          workspaceId: ctx.workspaceId!,
          title: input.title,
        },
      });
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return prisma.conversation.findMany({
      where: {
        workspaceId: ctx.workspaceId!,
        // Only show conversations that have a title (i.e., user has sent at least one message)
        title: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        updatedAt: true,
      },
    });
  }),

  getLatest: protectedProcedure.query(async ({ ctx }) => {
    const conversation = await prisma.conversation.findFirst({
      where: { workspaceId: ctx.workspaceId! },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: { role: true, content: true },
        },
      },
    });
    return conversation;
  }),

  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify conversation belongs to workspace
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: input.conversationId,
          workspaceId: ctx.workspaceId!,
        },
      });

      if (!conversation) return [];

      return prisma.message.findMany({
        where: { conversationId: input.conversationId },
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true },
      });
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string(), title: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      return prisma.conversation.updateMany({
        where: { id: input.id, workspaceId: ctx.workspaceId! },
        data: { title: input.title },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return prisma.conversation.deleteMany({
        where: { id: input.id, workspaceId: ctx.workspaceId! },
      });
    }),
});
