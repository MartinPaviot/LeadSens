import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import { getConnectorConfig } from "./registry";

const apiKeyInputSchema = z.object({
  apiKey: z.string().min(1, "API key required"),
});

/**
 * Generic handler for API key-based integration connect.
 * Replaces all per-tool POST routes.
 */
export async function handleApiKeyConnect(
  req: Request,
  toolId: string,
): Promise<Response> {
  // 1. Auth
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user?.workspaceId) {
    return new Response("No workspace", { status: 403 });
  }

  // 2. Registry lookup
  const config = getConnectorConfig(toolId);
  if (!config) {
    return Response.json(
      { error: `Unknown integration: ${toolId}` },
      { status: 404 },
    );
  }

  if (config.authMethod !== "api_key") {
    return Response.json(
      { error: `${config.name} does not support API key authentication` },
      { status: 400 },
    );
  }

  // 3. Parse & validate input (Zod)
  const parsed = apiKeyInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "API key required" }, { status: 400 });
  }
  const { apiKey } = parsed.data;

  // 4. Test connection (if connector has a test function)
  if (config.testConnection) {
    const result = await config.testConnection(apiKey);
    if (!result.ok) {
      return Response.json(
        {
          error:
            result.error ??
            `Invalid API key. Check your ${config.name} API key.`,
        },
        { status: 400 },
      );
    }

    // 5. Encrypt and upsert
    await prisma.integration.upsert({
      where: {
        workspaceId_type: { workspaceId: user.workspaceId, type: toolId },
      },
      create: {
        workspaceId: user.workspaceId,
        type: toolId,
        apiKey: encrypt(apiKey),
        accountEmail:
          typeof result.meta?.accountEmail === "string"
            ? result.meta.accountEmail
            : undefined,
        status: "ACTIVE",
      },
      update: {
        apiKey: encrypt(apiKey),
        accountEmail:
          typeof result.meta?.accountEmail === "string"
            ? result.meta.accountEmail
            : undefined,
        status: "ACTIVE",
      },
    });

    // 6. Post-connect hook (e.g. auto-create webhooks)
    let setup: { actions?: string[]; warnings?: string[] } = {};
    if (config.onConnect) {
      try {
        setup = await config.onConnect(apiKey);
      } catch {
        // Non-blocking — connection is already saved
      }
    }

    return Response.json({
      connected: true,
      ...result.meta,
      ...(setup.actions?.length ? { setup_actions: setup.actions } : {}),
      ...(setup.warnings?.length ? { setup_warnings: setup.warnings } : {}),
    });
  }

  // No test function — store directly (for future connectors without validation)
  await prisma.integration.upsert({
    where: {
      workspaceId_type: { workspaceId: user.workspaceId, type: toolId },
    },
    create: {
      workspaceId: user.workspaceId,
      type: toolId,
      apiKey: encrypt(apiKey),
      status: "ACTIVE",
    },
    update: {
      apiKey: encrypt(apiKey),
      status: "ACTIVE",
    },
  });

  return Response.json({ connected: true });
}

/**
 * Generic handler for integration disconnect.
 * Replaces all per-tool DELETE routes.
 */
export async function handleDisconnect(
  req: Request,
  toolId: string,
): Promise<Response> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user?.workspaceId) {
    return new Response("No workspace", { status: 403 });
  }

  await prisma.integration.deleteMany({
    where: { workspaceId: user.workspaceId, type: toolId },
  });

  return Response.json({ disconnected: true });
}
