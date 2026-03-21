import { z } from "zod/v4";
import { Prisma } from "@leadsens/db";
import { prisma } from "@/lib/prisma";
import { router, protectedProcedure } from "../trpc";

const competitorSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
});

const upsertInput = z.object({
  brand_name: z.string().min(1),
  brand_url: z.string().url(),
  country: z.string().min(1),
  language: z.string().min(1),
  competitors: z.array(competitorSchema).min(1).max(5),
  primary_keyword: z.string().min(1),
  secondary_keyword: z.string().min(1),
  exportFormat: z.enum(["pdf", "gdoc"]).default("pdf"),
});

export const brandProfileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return prisma.elevayBrandProfile.findUnique({
      where: { workspaceId: ctx.workspaceId },
    });
  }),

  upsert: protectedProcedure
    .input(upsertInput)
    .mutation(async ({ ctx, input }) => {
      return prisma.elevayBrandProfile.upsert({
        where: { workspaceId: ctx.workspaceId },
        create: {
          workspaceId: ctx.workspaceId,
          brand_name: input.brand_name,
          brand_url: input.brand_url,
          country: input.country,
          language: input.language,
          competitors: input.competitors as unknown as Prisma.InputJsonValue,
          primary_keyword: input.primary_keyword,
          secondary_keyword: input.secondary_keyword,
          exportFormat: input.exportFormat,
        },
        update: {
          brand_name: input.brand_name,
          brand_url: input.brand_url,
          country: input.country,
          language: input.language,
          competitors: input.competitors as unknown as Prisma.InputJsonValue,
          primary_keyword: input.primary_keyword,
          secondary_keyword: input.secondary_keyword,
          exportFormat: input.exportFormat,
        },
      });
    }),
});
