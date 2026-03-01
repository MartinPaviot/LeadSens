import { prisma } from "@/lib/prisma";

/**
 * Captures a user's style correction for future email drafting.
 */
export async function captureStyleCorrection(
  workspaceId: string,
  original: string,
  edit: string,
  contentType: string,
): Promise<void> {
  await prisma.agentFeedback.create({
    data: {
      workspaceId,
      type: "USER_EDIT",
      originalOutput: original,
      userEdit: edit,
      metadata: { contentType },
    },
  });
}

/**
 * Retrieves recent style corrections to include in email prompts.
 */
export async function getStyleSamples(
  workspaceId: string,
  limit = 5,
): Promise<string[]> {
  const corrections = await prisma.agentFeedback.findMany({
    where: { workspaceId, type: "USER_EDIT" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return corrections.map(
    (c) => `Original: "${c.originalOutput}"\nCorrected: "${c.userEdit}"`,
  );
}
