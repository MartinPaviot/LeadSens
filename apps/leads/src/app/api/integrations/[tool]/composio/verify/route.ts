import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@leadsens/db";
import { getConnectionStatus } from "@/server/lib/composio/connection";
import { isComposioEnabled } from "@/server/lib/composio/client";
import { invalidateIntegrationCache } from "@/server/lib/providers";
import { logger } from "@/lib/logger";

const verifyQuerySchema = z.object({
  connectionId: z.string().min(1, "connectionId required"),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params;
  const toolId = tool.toUpperCase();

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!isComposioEnabled()) {
    return Response.json({ error: "OAuth connection not available" }, { status: 503 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user?.workspaceId) {
    return Response.json({ error: "No workspace" }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = verifyQuerySchema.safeParse({
    connectionId: url.searchParams.get("connectionId") ?? "",
  });
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "connectionId required" },
      { status: 400 },
    );
  }

  const { connectionId } = parsed.data;

  try {
    const { status, isActive } = await getConnectionStatus(connectionId);

    if (isActive) {
      const metadata = { connectionId } as unknown as Prisma.InputJsonValue;

      await prisma.integration.upsert({
        where: {
          workspaceId_type: { workspaceId: user.workspaceId, type: toolId },
        },
        create: {
          workspaceId: user.workspaceId,
          type: toolId,
          status: "ACTIVE",
          metadata,
        },
        update: {
          status: "ACTIVE",
          metadata,
        },
      });

      await invalidateIntegrationCache(user.workspaceId);

      logger.info("[composio-oauth] Connection verified and stored", {
        toolId,
        workspaceId: user.workspaceId,
        connectionId,
      });
    }

    return Response.json({ connected: isActive, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    logger.error("[composio-oauth] Failed to verify connection", {
      toolId,
      connectionId,
      error: message,
    });
    return Response.json({ error: message }, { status: 500 });
  }
}
