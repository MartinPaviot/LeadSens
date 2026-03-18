/**
 * Composio Connection Manager — Creates and manages connections for workspaces.
 *
 * Each workspace maps to a Composio "user" (entity).
 * Connections are created per-app per-workspace.
 *
 * Auth config IDs are per-app and stored as env vars (configured in Composio dashboard).
 */

import { AuthScheme } from "@composio/core";
import { logger } from "@/lib/logger";
import { getComposioClient } from "./client";

// ─── Auth Config IDs (from Composio dashboard, stored as env vars) ──

const AUTH_CONFIGS: Record<string, string | undefined> = {
  HUBSPOT: process.env.COMPOSIO_AUTH_CONFIG_HUBSPOT,
  SALESFORCE: process.env.COMPOSIO_AUTH_CONFIG_SALESFORCE,
  PIPEDRIVE: process.env.COMPOSIO_AUTH_CONFIG_PIPEDRIVE,
  APOLLO: process.env.COMPOSIO_AUTH_CONFIG_APOLLO,
  SLACK: process.env.COMPOSIO_AUTH_CONFIG_SLACK,
  CALENDLY: process.env.COMPOSIO_AUTH_CONFIG_CALENDLY,
  AIRTABLE: process.env.COMPOSIO_AUTH_CONFIG_AIRTABLE,
  NOTION: process.env.COMPOSIO_AUTH_CONFIG_NOTION,
  LEMLIST: process.env.COMPOSIO_AUTH_CONFIG_LEMLIST,
  INSTANTLY: process.env.COMPOSIO_AUTH_CONFIG_INSTANTLY,
  ZOOMINFO: process.env.COMPOSIO_AUTH_CONFIG_ZOOMINFO,
  GOOGLE_SHEETS: process.env.COMPOSIO_AUTH_CONFIG_GOOGLE_SHEETS,
};

function getAuthConfigId(app: string): string {
  const configId = AUTH_CONFIGS[app];
  if (!configId) {
    throw new Error(
      `No Composio auth config for ${app}. Set COMPOSIO_AUTH_CONFIG_${app} in .env.`,
    );
  }
  return configId;
}

// ─── API Key Connection ─────────────────────────────────

export interface ConnectionResult {
  connectionId: string;
  status: string;
}

/**
 * Connect a workspace to an app using an API key.
 * Creates an immediate connection (no redirect needed).
 */
export async function connectWithApiKey(
  workspaceId: string,
  app: string,
  apiKey: string,
): Promise<ConnectionResult> {
  const client = getComposioClient();
  const authConfigId = getAuthConfigId(app);

  const connection = await client.connectedAccounts.initiate(
    workspaceId,
    authConfigId,
    {
      config: AuthScheme.APIKey({
        api_key: apiKey,
      }),
    },
  );

  logger.info("[composio] API key connection created", {
    app,
    workspaceId,
    connectionId: connection.id,
    status: connection.status,
  });

  return {
    connectionId: connection.id,
    status: connection.status ?? "active",
  };
}

// ─── OAuth Connection ───────────────────────────────────

export interface OAuthConnectionResult {
  connectionId: string;
  redirectUrl: string;
}

/**
 * Initiate an OAuth connection for a workspace.
 * Returns a redirect URL for the user to complete authentication.
 */
export async function connectWithOAuth(
  workspaceId: string,
  app: string,
): Promise<OAuthConnectionResult> {
  const client = getComposioClient();
  const authConfigId = getAuthConfigId(app);

  const connection = await client.connectedAccounts.initiate(
    workspaceId,
    authConfigId,
  );

  if (!connection.redirectUrl) {
    throw new Error(
      `Composio OAuth for ${app} did not return a redirect URL. Check auth config.`,
    );
  }

  logger.info("[composio] OAuth connection initiated", {
    app,
    workspaceId,
    connectionId: connection.id,
  });

  return {
    connectionId: connection.id,
    redirectUrl: connection.redirectUrl,
  };
}

// ─── Connection Status ──────────────────────────────────

/**
 * Check if a Composio connection is active for a workspace + app.
 */
export async function getConnectionStatus(
  connectionId: string,
): Promise<{ status: string; isActive: boolean }> {
  const client = getComposioClient();
  const account = await client.connectedAccounts.get(connectionId);

  return {
    status: account.status ?? "unknown",
    isActive: account.status === "ACTIVE",
  };
}
