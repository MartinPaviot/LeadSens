import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import { getConnectorConfig } from "./registry";
import { isComposioEnabled } from "@/server/lib/composio/client";
import { connectWithApiKey } from "@/server/lib/composio/connection";
import { logger } from "@/lib/logger";

const apiKeyInputSchema = z.object({
  apiKey: z.string().min(1, "API key required"),
  preValidated: z.boolean().optional(),
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
  const { apiKey, preValidated } = parsed.data;

  // 4. Test connection — skip if client already validated via GET endpoint
  let resultMeta: Record<string, unknown> = {};
  if (config.testConnection && !preValidated) {
    const result = await config.testConnection(apiKey);
    if (!result.ok) {
      return Response.json(
        { error: result.error ?? `Invalid API key. Check your ${config.name} API key.` },
        { status: 400 },
      );
    }
    if (result.meta) resultMeta = result.meta as Record<string, unknown>;
  }

  // 5. Encrypt and upsert (unified path for all cases)
  const accessTokenMeta = typeof resultMeta.accessToken === "string" ? resultMeta.accessToken : null;
  const expiresAtMeta = typeof resultMeta.expiresAt === "number" ? new Date(resultMeta.expiresAt) : null;

  await prisma.integration.upsert({
    where: {
      workspaceId_type: { workspaceId: user.workspaceId, type: toolId },
    },
    create: {
      workspaceId: user.workspaceId,
      type: toolId,
      apiKey: encrypt(apiKey),
      accountEmail: typeof resultMeta.accountEmail === "string" ? resultMeta.accountEmail : undefined,
      accessToken: accessTokenMeta ? encrypt(accessTokenMeta) : null,
      expiresAt: expiresAtMeta,
      status: "ACTIVE",
    },
    update: {
      apiKey: encrypt(apiKey),
      accountEmail: typeof resultMeta.accountEmail === "string" ? resultMeta.accountEmail : undefined,
      accessToken: accessTokenMeta ? encrypt(accessTokenMeta) : null,
      expiresAt: expiresAtMeta,
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

  // 7. Composio dual-registration (best-effort, fire-and-forget)
  if (isComposioEnabled()) {
    connectWithApiKey(user.workspaceId, toolId, apiKey).catch((err: unknown) => {
      logger.warn("[api-key-handler] Composio dual-registration failed (non-blocking)", {
        toolId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  return Response.json({
    connected: true,
    ...resultMeta,
    ...(setup.actions?.length ? { setup_actions: setup.actions } : {}),
    ...(setup.warnings?.length ? { setup_warnings: setup.warnings } : {}),
  });
}

/**
 * Generic handler for API key validation (GET).
 * Calls testConnection without storing anything.
 * Key passed via x-api-key header to avoid query param logging.
 */
export async function handleValidateApiKey(
  req: Request,
  toolId: string,
): Promise<Response> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return Response.json({ valid: false, error: "No key provided" }, { status: 400 });
  }

  const config = getConnectorConfig(toolId);
  if (!config || config.authMethod !== "api_key") {
    return Response.json({ valid: false, error: "Unknown integration" }, { status: 404 });
  }

  if (!config.testConnection) {
    // No validator available — assume valid (will be verified on actual connect)
    return Response.json({ valid: true });
  }

  const result = await config.testConnection(apiKey);
  return Response.json({
    valid: result.ok,
    ...(result.ok ? {} : { error: result.error ?? "Invalid key" }),
  });
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
