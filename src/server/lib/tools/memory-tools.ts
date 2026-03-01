import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { ToolDefinition, ToolContext } from "./types";

export function createMemoryTools(ctx: ToolContext): Record<string, ToolDefinition> {
  return {
    save_memory: {
      name: "save_memory",
      description:
        "Save a key-value pair to workspace memory for future conversations. Do NOT use this for CompanyDNA — use analyze_company_site or update_company_dna instead.",
      parameters: z.object({
        key: z.string(),
        value: z.string(),
        category: z.enum(["GENERAL", "COMPANY_CONTEXT", "ICP_HISTORY", "STYLE"]),
      }),
      async execute(args) {
        // Safeguard: if the LLM saves company DNA via memory (bypassing
        // the dedicated tools), also sync to workspace.companyDna
        const isCompanyDna =
          args.category === "COMPANY_CONTEXT" &&
          (args.key === "companyDna" || args.key === "company_dna");

        if (isCompanyDna) {
          try {
            const parsed = JSON.parse(args.value);
            await prisma.workspace.update({
              where: { id: ctx.workspaceId },
              data: { companyDna: parsed as Prisma.InputJsonValue },
            });
          } catch {
            // Not valid JSON — save to memory only
          }
        }

        await prisma.agentMemory.upsert({
          where: {
            workspaceId_key: { workspaceId: ctx.workspaceId, key: args.key },
          },
          create: {
            workspaceId: ctx.workspaceId,
            key: args.key,
            value: args.value,
            category: args.category,
          },
          update: {
            value: args.value,
            category: args.category,
          },
        });

        return { saved: true, key: args.key };
      },
    },

    get_memories: {
      name: "get_memories",
      description: "Retrieve all memories for the current workspace.",
      parameters: z.object({
        category: z.enum(["GENERAL", "COMPANY_CONTEXT", "ICP_HISTORY", "STYLE"]).optional(),
      }),
      async execute(args) {
        const memories = await prisma.agentMemory.findMany({
          where: {
            workspaceId: ctx.workspaceId,
            ...(args.category && { category: args.category }),
          },
          orderBy: { updatedAt: "desc" },
        });

        return {
          memories: memories.map((m) => ({
            key: m.key,
            value: m.value,
            category: m.category,
            updatedAt: m.updatedAt,
          })),
          count: memories.length,
        };
      },
    },

    delete_memory: {
      name: "delete_memory",
      description: "Delete a memory entry by key.",
      parameters: z.object({
        key: z.string(),
      }),
      async execute(args) {
        const existing = await prisma.agentMemory.findUnique({
          where: {
            workspaceId_key: { workspaceId: ctx.workspaceId, key: args.key },
          },
        });

        if (!existing) {
          return { deleted: false, error: "Memory not found" };
        }

        await prisma.agentMemory.delete({
          where: { id: existing.id },
        });

        return { deleted: true, key: args.key };
      },
    },
  };
}
