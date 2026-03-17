import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { getConnectorConfig } from "@/server/lib/integrations/registry";
import { router, protectedProcedure } from "../trpc";

/** Validates that the type is a known connector ID from the registry */
const connectorIdSchema = z
  .string()
  .trim()
  .min(1)
  .refine((id) => getConnectorConfig(id) !== undefined, {
    message: "Unknown integration type",
  });

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
    .input(z.object({ type: connectorIdSchema }))
    .mutation(async ({ ctx, input }) => {
      await prisma.integration.deleteMany({
        where: { workspaceId: ctx.workspaceId!, type: input.type },
      });
      return { disconnected: true };
    }),
});
