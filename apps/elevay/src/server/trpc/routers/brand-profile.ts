import { z } from "zod/v4";
import { Prisma } from "@leadsens/db";
import { prisma } from "@/lib/prisma";
import { router, protectedProcedure } from "../trpc";

const competitorSchema = z.object({
  name: z.string().min(1),
  url:  z.string().url().or(z.literal("")),
});

const upsertInput = z.object({
  brand_name:        z.string().min(1),
  brand_url:         z.string().url(),
  country:           z.string().min(1),
  language:          z.string().min(1),
  competitors:       z.array(competitorSchema).min(1).max(3),
  primary_keyword:   z.string().min(1),
  secondary_keyword: z.string().min(1),
  exportFormat:      z.enum(["pdf", "gdoc"]).default("pdf"),
  sector:            z.string().max(100).optional(),
  priority_channels: z.array(
    z.enum(["SEO", "LinkedIn", "YouTube", "TikTok", "Instagram", "Facebook", "X", "Press"]),
  ).optional(),
  objective:         z.enum(["lead_gen", "acquisition", "retention", "branding"]).optional(),
  report_recurrence: z.enum(["on_demand", "weekly", "monthly", "quarterly"]).optional(),
});

export const brandProfileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await prisma.elevayBrandProfile.findUnique({
        where: { workspaceId: ctx.workspaceId },
      });
    } catch {
      return null;
    }
  }),

  upsert: protectedProcedure
    .input(upsertInput)
    .mutation(async ({ ctx, input }) => {
      return prisma.elevayBrandProfile.upsert({
        where: { workspaceId: ctx.workspaceId },
        create: {
          workspaceId:       ctx.workspaceId,
          brand_name:        input.brand_name,
          brand_url:         input.brand_url,
          country:           input.country,
          language:          input.language,
          competitors:       input.competitors as unknown as Prisma.InputJsonValue,
          primary_keyword:   input.primary_keyword,
          secondary_keyword: input.secondary_keyword,
          exportFormat:      input.exportFormat,
          sector:            input.sector,
          priority_channels: input.priority_channels ?? [],
          objective:         input.objective,
          report_recurrence: input.report_recurrence,
        },
        update: {
          brand_name:        input.brand_name,
          brand_url:         input.brand_url,
          country:           input.country,
          language:          input.language,
          competitors:       input.competitors as unknown as Prisma.InputJsonValue,
          primary_keyword:   input.primary_keyword,
          secondary_keyword: input.secondary_keyword,
          exportFormat:      input.exportFormat,
          sector:            input.sector,
          priority_channels: input.priority_channels ?? [],
          objective:         input.objective,
          report_recurrence: input.report_recurrence,
        },
      });
    }),
});
