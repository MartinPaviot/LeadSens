import { prisma } from "@/lib/prisma";
import { ComposioToolSet } from "composio-core";

/**
 * Retourne le type de connexion LinkedIn disponible pour ce workspace.
 * Checks Integration table for active linkedin connections.
 */
export async function getLinkedInConnection(
  workspaceId: string,
): Promise<"community" | "user" | "apify"> {
  try {
    const integrations = await prisma.integration.findMany({
      where: { workspaceId, status: 'ACTIVE', type: { in: ['linkedin-community', 'linkedin'] } },
      select: { type: true },
    });
    const types = new Set(integrations.map((i) => i.type));
    if (types.has('linkedin-community')) return "community";
    if (types.has('linkedin')) return "user";
  } catch {
    // best-effort
  }
  return "apify";
}

/**
 * Initie la connexion LinkedIn Community (scopes org) pour ce workspace.
 * Utilise COMPOSIO_LINKEDIN_COMMUNITY_AUTH_CONFIG_ID.
 * entityId : `${workspaceId}-community` pour isoler des connexions user.
 */
export async function initiateLinkedInCommunityConnection(
  workspaceId: string,
): Promise<string | null> {
  const toolset = new ComposioToolSet({ apiKey: process.env.COMPOSIO_API_KEY });
  const connection = await toolset.connectedAccounts.initiate({
    appName: "linkedin",
    authConfig: process.env.COMPOSIO_LINKEDIN_COMMUNITY_AUTH_CONFIG_ID
      ? { authConfigId: process.env.COMPOSIO_LINKEDIN_COMMUNITY_AUTH_CONFIG_ID }
      : undefined,
    entityId: `${workspaceId}-community`,
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/social/linkedin-community/callback`,
  });
  return connection.redirectUrl ?? null;
}
