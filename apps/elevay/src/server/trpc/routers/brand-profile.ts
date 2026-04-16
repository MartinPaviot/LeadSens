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
      const workspace = await prisma.workspace.findUnique({
        where: { id: ctx.workspaceId },
        select: {
          name: true,
          companyUrl: true,
          country: true,
          industry: true,
          settings: true,
        },
      });
      if (!workspace) return null;
      const settings = (workspace.settings as Record<string, unknown> | null) ?? {};
      return {
        workspaceId: ctx.workspaceId,
        brand_name: workspace.name,
        brand_url: workspace.companyUrl ?? '',
        country: workspace.country ?? '',
        language: (settings.language as string) ?? 'fr',
        competitors: (settings.competitors ?? []) as { name: string; url: string }[],
        primary_keyword: (settings.primaryKeyword as string) ?? '',
        secondary_keyword: (settings.secondaryKeyword as string) ?? '',
        exportFormat: (settings.exportFormat as string) ?? 'pdf',
        sector: workspace.industry ?? null,
        priority_channels: (settings.priorityChannels ?? []) as string[],
        objective: (settings.businessObjective as string | null) ?? null,
        report_recurrence: (settings.reportRecurrence as string | null) ?? null,
      };
    } catch {
      return null;
    }
  }),

  upsert: protectedProcedure
    .input(upsertInput)
    .mutation(async ({ ctx, input }) => {
      const workspace = await prisma.workspace.findUnique({
        where: { id: ctx.workspaceId },
        select: { settings: true },
      });
      const existingSettings = (workspace?.settings as Record<string, unknown> | null) ?? {};

      const newSettings = {
        ...existingSettings,
        language: input.language,
        competitors: input.competitors,
        primaryKeyword: input.primary_keyword,
        secondaryKeyword: input.secondary_keyword,
        exportFormat: input.exportFormat,
        priorityChannels: input.priority_channels ?? [],
        businessObjective: input.objective,
        reportRecurrence: input.report_recurrence,
      };

      const updated = await prisma.workspace.update({
        where: { id: ctx.workspaceId },
        data: {
          name: input.brand_name,
          companyUrl: input.brand_url,
          country: input.country,
          industry: input.sector,
          settings: newSettings as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        workspaceId: ctx.workspaceId,
        brand_name: updated.name,
        brand_url: updated.companyUrl ?? '',
        country: updated.country ?? '',
        language: input.language,
        competitors: input.competitors,
        primary_keyword: input.primary_keyword,
        secondary_keyword: input.secondary_keyword,
        exportFormat: input.exportFormat,
        sector: input.sector,
        priority_channels: input.priority_channels ?? [],
        objective: input.objective,
        report_recurrence: input.report_recurrence,
      };
    }),
});
