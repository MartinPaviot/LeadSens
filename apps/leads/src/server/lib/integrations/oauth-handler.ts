/**
 * Generic OAuth Handler — Reusable OAuth 2.0 flow for all OAuth connectors.
 *
 * Generalizes the HubSpot OAuth pattern. Supports:
 * - Standard OAuth 2.0 Authorization Code flow
 * - PKCE (for Outreach, ZoomInfo)
 * - Custom auth/token params per provider
 *
 * Usage:
 *   GET  /api/integrations/[tool]/auth     → handleOAuthStart(req, toolId)
 *   GET  /api/integrations/[tool]/callback  → handleOAuthCallback(req, toolId)
 */

import { z } from "zod/v4";
import { randomBytes, createHash } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { encrypt, decrypt } from "@/lib/encryption";
import { getConnectorConfig } from "./registry";
import { invalidateIntegrationCache } from "@/server/lib/providers";
import { logger } from "@/lib/logger";

const oauthCallbackSchema = z.object({
  code: z.string().min(1, "OAuth code required"),
});

// ─── PKCE Helpers ──────────────────────────────────────

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

// ─── OAuth Start ───────────────────────────────────────

export async function handleOAuthStart(
  req: Request,
  toolId: string,
): Promise<Response> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const config = getConnectorConfig(toolId);
  if (!config?.oauthConfig) {
    return Response.json(
      { error: `${toolId} does not support OAuth` },
      { status: 400 },
    );
  }

  const oauth = config.oauthConfig;
  const clientId = process.env[oauth.clientIdEnvVar];
  if (!clientId) {
    return Response.json(
      { error: `${config.name} OAuth not configured (missing ${oauth.clientIdEnvVar})` },
      { status: 500 },
    );
  }

  const redirectUri = `${appUrl}/api/integrations/${toolId.toLowerCase()}/callback`;

  // Build state with anti-CSRF token
  const stateToken = randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state: stateToken,
    ...oauth.extraAuthParams,
  });

  // Add scopes if specified
  if (oauth.scopes.length > 0) {
    // Slack uses comma-separated scopes in a different param
    if (toolId === "SLACK") {
      params.set("scope", oauth.scopes.join(","));
    } else {
      params.set("scope", oauth.scopes.join(" "));
    }
  }

  // PKCE support
  let codeVerifier: string | undefined;
  if (oauth.pkce) {
    codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
  }

  // Store state + PKCE verifier in a temporary record
  // We use the user's workspace to store this temporarily
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (user?.workspaceId) {
    const stateMetadata = {
      state: stateToken,
      codeVerifier: codeVerifier ?? null,
      createdAt: Date.now(),
    } as unknown as Prisma.InputJsonValue;

    await prisma.integration.upsert({
      where: {
        workspaceId_type: { workspaceId: user.workspaceId, type: `${toolId}_OAUTH_STATE` },
      },
      create: {
        workspaceId: user.workspaceId,
        type: `${toolId}_OAUTH_STATE`,
        status: "DISCONNECTED",
        metadata: stateMetadata,
      },
      update: {
        metadata: stateMetadata,
      },
    });
  }

  const authUrl = `${oauth.authUrl}?${params}`;
  return Response.redirect(authUrl);
}

// ─── OAuth Callback ────────────────────────────────────

export async function handleOAuthCallback(
  req: Request,
  toolId: string,
): Promise<Response> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return Response.redirect(`${appUrl}/login`);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user?.workspaceId) {
    return Response.redirect(`${appUrl}/login`);
  }

  const config = getConnectorConfig(toolId);
  if (!config?.oauthConfig) {
    return Response.redirect(`${appUrl}/settings/integrations?error=invalid_tool`);
  }

  const oauth = config.oauthConfig;
  const url = new URL(req.url);

  // Validate code
  const parsed = oauthCallbackSchema.safeParse({
    code: url.searchParams.get("code") ?? "",
  });
  if (!parsed.success) {
    return Response.redirect(`${appUrl}/settings/integrations?error=no_code`);
  }

  // Validate state
  const stateParam = url.searchParams.get("state") ?? "";
  const stateRecord = await prisma.integration.findUnique({
    where: {
      workspaceId_type: { workspaceId: user.workspaceId, type: `${toolId}_OAUTH_STATE` },
    },
  });
  const stateData = stateRecord?.metadata as { state?: string; codeVerifier?: string | null } | null;

  if (!stateData?.state || stateData.state !== stateParam) {
    logger.warn(`[oauth] State mismatch for ${toolId}`, { expected: stateData?.state, got: stateParam });
    return Response.redirect(`${appUrl}/settings/integrations?error=state_mismatch`);
  }

  const clientId = process.env[oauth.clientIdEnvVar];
  const clientSecret = process.env[oauth.clientSecretEnvVar];
  if (!clientId || !clientSecret) {
    return Response.redirect(`${appUrl}/settings/integrations?error=${toolId.toLowerCase()}_not_configured`);
  }

  const redirectUri = `${appUrl}/api/integrations/${toolId.toLowerCase()}/callback`;

  try {
    // Exchange code for tokens
    const tokenParams: Record<string, string> = {
      grant_type: "authorization_code",
      code: parsed.data.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      ...oauth.extraTokenParams,
    };

    // PKCE verifier
    if (oauth.pkce && stateData.codeVerifier) {
      tokenParams.code_verifier = stateData.codeVerifier;
    }

    const tokenRes = await fetch(oauth.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(tokenParams),
      signal: AbortSignal.timeout(15_000),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text().catch(() => "");
      logger.error(`[oauth] Token exchange failed for ${toolId}`, { status: tokenRes.status, body: text.slice(0, 300) });
      return Response.redirect(`${appUrl}/settings/integrations?error=${toolId.toLowerCase()}_failed`);
    }

    const tokenData = await tokenRes.json() as Record<string, unknown>;

    // Extract tokens (handle different response formats)
    const accessToken = (tokenData.access_token ?? tokenData.accessToken) as string;
    const refreshToken = (tokenData.refresh_token ?? tokenData.refreshToken) as string | undefined;
    const expiresIn = (tokenData.expires_in ?? tokenData.expiresIn ?? 3600) as number;

    // Some providers return extra metadata (e.g. Salesforce instance_url, Slack team info)
    const metadata: Record<string, unknown> = {};
    if (tokenData.instance_url) metadata.instanceUrl = tokenData.instance_url;
    if (tokenData.team) metadata.team = tokenData.team;
    const metadataJson = Object.keys(metadata).length > 0
      ? (metadata as unknown as Prisma.InputJsonValue)
      : undefined;

    // Store integration
    await prisma.integration.upsert({
      where: {
        workspaceId_type: { workspaceId: user.workspaceId, type: toolId },
      },
      create: {
        workspaceId: user.workspaceId,
        type: toolId,
        accessToken: encrypt(accessToken),
        refreshToken: refreshToken ? encrypt(refreshToken) : null,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        status: "ACTIVE",
        metadata: metadataJson,
      },
      update: {
        accessToken: encrypt(accessToken),
        refreshToken: refreshToken ? encrypt(refreshToken) : null,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        status: "ACTIVE",
        metadata: metadataJson,
      },
    });

    // Clean up state record
    await prisma.integration.deleteMany({
      where: {
        workspaceId: user.workspaceId,
        type: `${toolId}_OAUTH_STATE`,
      },
    });

    // Invalidate provider cache
    await invalidateIntegrationCache(user.workspaceId);

    logger.info(`[oauth] ${toolId} connected successfully`, { workspaceId: user.workspaceId });
    return Response.redirect(`${appUrl}/settings/integrations?connected=${toolId.toLowerCase()}`);
  } catch (err) {
    logger.error(`[oauth] ${toolId} callback error`, { error: err instanceof Error ? err.message : "unknown" });
    return Response.redirect(`${appUrl}/settings/integrations?error=${toolId.toLowerCase()}_failed`);
  }
}

// ─── Token Refresh ─────────────────────────────────────

/**
 * Refresh an OAuth token for any connector.
 * Called internally by connector implementations when tokens expire.
 */
export async function refreshOAuthToken(
  workspaceId: string,
  toolId: string,
): Promise<string> {
  const config = getConnectorConfig(toolId);
  if (!config?.oauthConfig) {
    throw new Error(`${toolId} does not support OAuth`);
  }

  const integration = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId, type: toolId } },
  });

  if (!integration?.refreshToken) {
    throw new Error(`No refresh token for ${toolId}`);
  }

  const oauth = config.oauthConfig;
  const clientId = process.env[oauth.clientIdEnvVar];
  const clientSecret = process.env[oauth.clientSecretEnvVar];
  if (!clientId || !clientSecret) {
    throw new Error(`${toolId} OAuth credentials not configured`);
  }

  const decryptedRefresh = decrypt(integration.refreshToken);

  const tokenParams: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: decryptedRefresh,
    client_id: clientId,
    client_secret: clientSecret,
    ...oauth.extraTokenParams,
  };

  const res = await fetch(oauth.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(tokenParams),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error(`[oauth] Token refresh failed for ${toolId}`, { status: res.status, body: text.slice(0, 200) });
    throw new Error(`${toolId} token refresh failed: ${res.status}`);
  }

  const data = await res.json() as Record<string, unknown>;
  const newAccessToken = (data.access_token ?? data.accessToken) as string;
  const newRefreshToken = (data.refresh_token ?? data.refreshToken) as string | undefined;
  const expiresIn = (data.expires_in ?? data.expiresIn ?? 3600) as number;

  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      accessToken: encrypt(newAccessToken),
      // Some providers rotate refresh tokens
      ...(newRefreshToken ? { refreshToken: encrypt(newRefreshToken) } : {}),
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    },
  });

  // Invalidate cache
  await invalidateIntegrationCache(workspaceId);

  return newAccessToken;
}

/**
 * Get a valid access token for an OAuth integration.
 * Auto-refreshes if the token is about to expire (within 5 minutes).
 */
export async function getOAuthAccessToken(
  workspaceId: string,
  toolId: string,
): Promise<string> {
  const integration = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId, type: toolId } },
  });

  if (!integration?.accessToken) {
    throw new Error(`${toolId} not connected`);
  }

  // Auto-refresh if expires within 5 minutes
  if (integration.expiresAt && integration.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    // Some providers (like Slack bot tokens) don't expire
    if (integration.refreshToken) {
      return refreshOAuthToken(workspaceId, toolId);
    }
  }

  return decrypt(integration.accessToken);
}
