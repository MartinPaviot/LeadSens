import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { connectWithOAuth } from "@/server/lib/composio/connection";
import { isComposioEnabled } from "@/server/lib/composio/client";
import { logger } from "@/lib/logger";

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

  try {
    const { connectionId, redirectUrl } = await connectWithOAuth(
      user.workspaceId,
      toolId,
    );

    logger.info("[composio-oauth] OAuth initiated", {
      toolId,
      workspaceId: user.workspaceId,
      connectionId,
    });

    return Response.json({ redirectUrl, connectionId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth initiation failed";
    logger.error("[composio-oauth] Failed to initiate OAuth", {
      toolId,
      error: message,
    });
    return Response.json({ error: message }, { status: 500 });
  }
}
