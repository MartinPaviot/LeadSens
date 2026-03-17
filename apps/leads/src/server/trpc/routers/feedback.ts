import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { captureStyleCorrection } from "@/server/lib/email/style-learner";
import { router, protectedProcedure } from "../trpc";

export const feedbackRouter = router({
  submitEdit: protectedProcedure
    .input(
      z.object({
        original: z.string(),
        edit: z.string(),
        contentType: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await captureStyleCorrection(
        ctx.workspaceId!,
        input.original,
        input.edit,
        input.contentType,
      );
      return { saved: true };
    }),

  submitThumbs: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
        rating: z.enum(["up", "down"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.agentFeedback.create({
        data: {
          workspaceId: ctx.workspaceId!,
          type: input.rating === "up" ? "THUMBS_UP" : "THUMBS_DOWN",
          originalOutput: input.messageId,
          metadata: { rating: input.rating },
        },
      });
      return { saved: true };
    }),
});
