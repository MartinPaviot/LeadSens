import { prisma } from "@/lib/prisma";
import type { AgentOutput } from "@/agents/_shared/types";

/**
 * Retourne le dernier run complété pour un agent donné dans un workspace.
 * Utilisé par CIA-03 pour la comparaison historique (previous_scores).
 */
export async function getLatestOutputByAgent(
  workspaceId: string,
  agentCode: "BPI-01" | "MTS-02" | "CIA-03",
): Promise<AgentOutput<unknown> | null> {
  const run = await prisma.elevayAgentRun.findFirst({
    where: {
      workspaceId,
      agentCode,
      status: "COMPLETED",
    },
    orderBy: { createdAt: "desc" },
    select: { output: true },
  });

  if (!run?.output) return null;
  return run.output as unknown as AgentOutput<unknown>;
}
