import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  analyzeClientSite,
  companyDnaSchema,
  type CompanyDna,
} from "@/server/lib/enrichment/company-analyzer";
import { generateCampaignAngle } from "@/server/lib/email/campaign-angle";
import type { ToolDefinition, ToolContext } from "./types";

export function createCompanyTools(
  ctx: ToolContext,
): Record<string, ToolDefinition> {
  return {
    analyze_company_site: {
      name: "analyze_company_site",
      description:
        "Analyze the client's website to extract structured CompanyDNA (value proposition, target buyers, differentiators, etc.). Use when the user provides their company URL during onboarding.",
      parameters: z.object({
        url: z.string().describe("The company website URL"),
      }),
      async execute(args) {
        const companyDna = await analyzeClientSite(
          args.url,
          ctx.workspaceId,
          ctx.onStatus,
        );

        ctx.onStatus?.("Saving company profile...");

        await prisma.workspace.update({
          where: { id: ctx.workspaceId },
          data: {
            companyUrl: args.url,
            companyDna: companyDna as unknown as Prisma.InputJsonValue,
          },
        });

        // Persist in agent memory for system prompt injection
        await prisma.agentMemory.upsert({
          where: {
            workspaceId_key: {
              workspaceId: ctx.workspaceId,
              key: "company_dna",
            },
          },
          create: {
            workspaceId: ctx.workspaceId,
            key: "company_dna",
            value: JSON.stringify(companyDna),
            category: "COMPANY_CONTEXT",
          },
          update: {
            value: JSON.stringify(companyDna),
          },
        });

        return companyDna;
      },
    },

    update_company_dna: {
      name: "update_company_dna",
      description:
        "Update specific fields of the CompanyDNA after user corrections. Use when the user says 'actually we focus on X' or asks to change a detail.",
      parameters: z.object({
        updates: z
          .record(z.string(), z.unknown())
          .describe("Partial CompanyDNA fields to update"),
      }),
      async execute(args) {
        const workspace = await prisma.workspace.findUniqueOrThrow({
          where: { id: ctx.workspaceId },
        });

        if (!workspace.companyDna) {
          return {
            error:
              "No CompanyDNA exists yet. Use analyze_company_site first.",
          };
        }

        const existing = workspace.companyDna as unknown as CompanyDna;
        const merged = { ...existing, ...args.updates };
        const validated = companyDnaSchema.parse(merged);

        await prisma.workspace.update({
          where: { id: ctx.workspaceId },
          data: {
            companyDna: validated as unknown as Prisma.InputJsonValue,
          },
        });

        await prisma.agentMemory.upsert({
          where: {
            workspaceId_key: {
              workspaceId: ctx.workspaceId,
              key: "company_dna",
            },
          },
          create: {
            workspaceId: ctx.workspaceId,
            key: "company_dna",
            value: JSON.stringify(validated),
            category: "COMPANY_CONTEXT",
          },
          update: {
            value: JSON.stringify(validated),
          },
        });

        return validated;
      },
    },

    generate_campaign_angle: {
      name: "generate_campaign_angle",
      description:
        "Generate a campaign-specific positioning angle based on CompanyDNA and the target ICP. Call after scoring and before drafting emails. Present the result to the user for validation.",
      parameters: z.object({
        campaign_id: z.string(),
        icp_description: z
          .string()
          .describe(
            "The target persona description (role, industry, company size)",
          ),
      }),
      async execute(args) {
        const workspace = await prisma.workspace.findUniqueOrThrow({
          where: { id: ctx.workspaceId },
        });

        if (!workspace.companyDna) {
          return {
            error:
              "CompanyDNA not set. Ask the user for their website URL first.",
          };
        }

        const companyDna = workspace.companyDna as unknown as CompanyDna;

        ctx.onStatus?.("Generating campaign angle...");

        const angle = await generateCampaignAngle(
          companyDna,
          args.icp_description,
          ctx.workspaceId,
        );

        await prisma.campaign.update({
          where: { id: args.campaign_id },
          data: {
            angle: angle as unknown as Prisma.InputJsonValue,
          },
        });

        return angle;
      },
    },
  };
}
