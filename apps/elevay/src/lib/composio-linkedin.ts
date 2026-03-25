import { prisma } from "@/lib/prisma";
import { ComposioToolSet } from "composio-core";

/**
 * Retourne le type de connexion LinkedIn disponible pour ce workspace.
 * Vérifie social_connections en DB.
 */
export async function getLinkedInConnection(
  workspaceId: string,
): Promise<"community" | "user" | "apify"> {
  try {
    const profile = await prisma.elevayBrandProfile.findUnique({
      where: { workspaceId },
      select: { social_connections: true },
    });
    const conn = profile?.social_connections as Record<string, boolean | string> | null;
    if (conn?.["linkedin-community"] === true) return "community";
    if (conn?.["linkedin"] === true) return "user";
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
