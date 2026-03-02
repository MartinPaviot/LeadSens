import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  analyzeClientSite,
  companyDnaSchema,
} from "@/server/lib/enrichment/company-analyzer";
import { router, protectedProcedure } from "../trpc";

// ─── Normalize LLM-generated memory data to match CompanyDNA schema ──

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function normalizeMemoryToSchema(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  // Map known keys (snake_case and alternative names)
  out.oneLiner =
    raw.oneLiner ?? raw.one_liner ?? raw.oneliner ?? "";

  // targetBuyers can come as "personas", "target_buyers", etc.
  const buyers = raw.targetBuyers ?? raw.target_buyers ?? raw.personas;
  if (Array.isArray(buyers)) {
    out.targetBuyers = buyers.map((b: Record<string, unknown>) => ({
      role: b.role ?? b.name ?? b.title ?? "",
      sellingAngle:
        b.sellingAngle ?? b.selling_angle ?? b.description ?? b.angle ?? "",
    }));
  } else {
    out.targetBuyers = [];
  }

  // Array fields — accept snake_case variants
  out.keyResults = raw.keyResults ?? raw.key_results ?? [];
  out.differentiators = raw.differentiators ?? [];
  out.problemsSolved = raw.problemsSolved ?? raw.problems_solved ?? [];

  // socialProof — migrate from proofPoints if needed
  const socialProofRaw = raw.socialProof ?? raw.social_proof;
  if (Array.isArray(socialProofRaw) && socialProofRaw.length > 0 && typeof socialProofRaw[0] === "object") {
    out.socialProof = socialProofRaw;
  } else {
    // Migrate flat proofPoints to socialProof with "General" industry
    const flatProof = raw.proofPoints ?? raw.proof_points ?? raw.social_proof;
    if (Array.isArray(flatProof) && flatProof.length > 0 && typeof flatProof[0] === "string") {
      out.socialProof = [{ industry: "General", clients: flatProof as string[] }];
    } else if (flatProof && typeof flatProof === "object" && !Array.isArray(flatProof)) {
      const entries = Object.entries(flatProof as Record<string, unknown>).map(
        ([k, v]) => `${snakeToCamel(k)}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`,
      );
      out.socialProof = entries.length > 0 ? [{ industry: "General", clients: entries }] : [];
    } else {
      out.socialProof = [];
    }
  }

  // New fields with defaults
  out.toneOfVoice = raw.toneOfVoice ?? raw.tone_of_voice ?? { register: "conversational", traits: [], avoidWords: [] };
  out.ctas = raw.ctas ?? [];
  out.senderIdentity = raw.senderIdentity ?? raw.sender_identity ?? { name: "", role: "", signatureHook: "" };
  out.objections = raw.objections ?? [];

  out.pricingModel =
    raw.pricingModel ?? raw.pricing_model ?? raw.pricing ?? null;

  return out;
}

export const workspaceRouter = router({
  getCompanyDna: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: ctx.workspaceId! },
      select: { companyDna: true, companyUrl: true },
    });

    let dnaSource: Record<string, unknown> | null =
      workspace.companyDna as Record<string, unknown> | null;

    // Fallback: if workspace.companyDna is null, try agentMemory
    if (!dnaSource) {
      const memory = await prisma.agentMemory.findUnique({
        where: {
          workspaceId_key: {
            workspaceId: ctx.workspaceId!,
            key: "companyDna",
          },
        },
      });

      const memoryAlt = memory
        ? null
        : await prisma.agentMemory.findUnique({
            where: {
              workspaceId_key: {
                workspaceId: ctx.workspaceId!,
                key: "company_dna",
              },
            },
          });

      const memoryData = memory ?? memoryAlt;
      if (memoryData) {
        try {
          dnaSource = JSON.parse(memoryData.value);
        } catch {
          // Invalid JSON — ignore
        }
      }
    }

    let companyUrl = workspace.companyUrl;

    // Normalize: if data exists but uses wrong keys (snake_case, "personas", etc.)
    if (dnaSource) {
      const parseResult = companyDnaSchema.safeParse(dnaSource);
      if (!parseResult.success || !parseResult.data.oneLiner) {
        // Data needs normalization
        const normalized = normalizeMemoryToSchema(dnaSource);
        const validated = companyDnaSchema.safeParse(normalized);
        if (validated.success) {
          dnaSource = validated.data as unknown as Record<string, unknown>;

          // Try to extract URL from raw data if workspace doesn't have one
          if (!companyUrl) {
            const rawUrl =
              (dnaSource as Record<string, unknown>).url ??
              (dnaSource as Record<string, unknown>).website ??
              (dnaSource as Record<string, unknown>).companyUrl;
            if (typeof rawUrl === "string" && rawUrl.startsWith("http")) {
              companyUrl = rawUrl;
            }
          }

          // Persist normalized version so this doesn't repeat
          await prisma.workspace.update({
            where: { id: ctx.workspaceId! },
            data: {
              companyDna: dnaSource as Prisma.InputJsonValue,
              ...(companyUrl && !workspace.companyUrl
                ? { companyUrl }
                : {}),
            },
          });
        }
      }
    }

    // Last resort: if we still have no URL but have DNA, check user messages
    // for the first URL the user sent
    if (!companyUrl && dnaSource) {
      const firstUrlMessage = await prisma.message.findFirst({
        where: {
          conversation: { workspaceId: ctx.workspaceId! },
          role: "USER",
          content: { contains: "http" },
        },
        orderBy: { createdAt: "asc" },
        select: { content: true },
      });

      if (firstUrlMessage) {
        const urlMatch = firstUrlMessage.content.match(
          /https?:\/\/[^\s,)}\]]+/,
        );
        if (urlMatch) {
          companyUrl = urlMatch[0];
          await prisma.workspace.update({
            where: { id: ctx.workspaceId! },
            data: { companyUrl },
          });
        }
      }
    }

    return {
      companyDna: dnaSource,
      companyUrl,
    };
  }),

  updateCompanyDna: protectedProcedure
    .input(z.object({ companyDna: companyDnaSchema }))
    .mutation(async ({ ctx, input }) => {
      const validated = companyDnaSchema.parse(input.companyDna);

      await prisma.workspace.update({
        where: { id: ctx.workspaceId! },
        data: {
          companyDna: validated as unknown as Prisma.InputJsonValue,
        },
      });

      // Dual persistence: also update agentMemory (same pattern as company-tools.ts)
      await prisma.agentMemory.upsert({
        where: {
          workspaceId_key: {
            workspaceId: ctx.workspaceId!,
            key: "company_dna",
          },
        },
        create: {
          workspaceId: ctx.workspaceId!,
          key: "company_dna",
          value: JSON.stringify(validated),
          category: "COMPANY_CONTEXT",
        },
        update: {
          value: JSON.stringify(validated),
        },
      });

      return validated;
    }),

  analyzeUrl: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const companyDna = await analyzeClientSite(
        input.url,
        ctx.workspaceId!,
      );

      // Persist in workspace
      await prisma.workspace.update({
        where: { id: ctx.workspaceId! },
        data: {
          companyUrl: input.url,
          companyDna: companyDna as unknown as Prisma.InputJsonValue,
        },
      });

      // Dual persistence: agentMemory
      await prisma.agentMemory.upsert({
        where: {
          workspaceId_key: {
            workspaceId: ctx.workspaceId!,
            key: "company_dna",
          },
        },
        create: {
          workspaceId: ctx.workspaceId!,
          key: "company_dna",
          value: JSON.stringify(companyDna),
          category: "COMPANY_CONTEXT",
        },
        update: {
          value: JSON.stringify(companyDna),
        },
      });

      return companyDna;
    }),
});
