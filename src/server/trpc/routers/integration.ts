import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { router, protectedProcedure } from "../trpc";

export const integrationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return prisma.integration.findMany({
      where: { workspaceId: ctx.workspaceId! },
      select: {
        type: true,
        status: true,
        accountEmail: true,
        accountName: true,
        createdAt: true,
      },
    });
  }),

  disconnect: protectedProcedure
    .input(z.object({ type: z.enum(["INSTANTLY", "HUBSPOT"]) }))
    .mutation(async ({ ctx, input }) => {
      await prisma.integration.deleteMany({
        where: { workspaceId: ctx.workspaceId!, type: input.type },
      });
      return { disconnected: true };
    }),
});
