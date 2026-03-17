/**
 * Salesforce API Client — OAuth helpers + REST API.
 *
 * Auth: OAuth 2.0 (Authorization Code flow)
 * Instance URL varies per customer (stored in metadata.instanceUrl)
 * API version: v59.0
 *
 * Pattern: mirrors hubspot.ts (OAuth helpers + internal token management)
 */

import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";

const SF_AUTH_BASE = "https://login.salesforce.com";
const SF_API_VERSION = "v59.0";

// ─── Response schemas ───────────────────────────────────

const TokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number().optional(),
  instance_url: z.string(),
});

const SalesforceContactSchema = z.object({
  Id: z.string(),
  Email: z.string().nullable().optional(),
  FirstName: z.string().nullable().optional(),
  LastName: z.string().nullable().optional(),
  Account: z
    .object({ Name: z.string().nullable().optional() })
    .nullable()
    .optional(),
  Title: z.string().nullable().optional(),
  Phone: z.string().nullable().optional(),
});

const SOQLResultSchema = z.object({
  totalSize: z.number(),
  done: z.boolean(),
  records: z.array(SalesforceContactSchema),
});

const CreateResultSchema = z.object({
  id: z.string(),
  success: z.boolean(),
});

// ─── Exported types ─────────────────────────────────────

export interface SalesforceContact {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
}

// ─── OAuth Helpers ──────────────────────────────────────

export function getAuthUrl(
  clientId: string,
  redirectUri: string,
  scopes: string[],
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    response_type: "code",
  });
  return `${SF_AUTH_BASE}/services/oauth2/authorize?${params}`;
}

export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  instanceUrl: string;
}> {
  const res = await fetch(`${SF_AUTH_BASE}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Salesforce OAuth exchange failed: ${res.status} ${text}`);
  }

  const raw = await res.json();
  const data = TokenResponseSchema.parse(raw);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    // Salesforce doesn't always return expires_in — default to 2 hours
    expiresIn: data.expires_in ?? 7200,
    instanceUrl: data.instance_url,
  };
}

// ─── Internal Token Management ──────────────────────────

async function refreshAccessToken(integration: {
  id: string;
  refreshToken: string | null;
  metadata: unknown;
}): Promise<{ accessToken: string; instanceUrl: string }> {
  if (!integration.refreshToken) {
    throw new Error("No refresh token available for Salesforce");
  }

  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Salesforce OAuth credentials not configured");
  }

  const decryptedRefresh = decrypt(integration.refreshToken);

  const res = await fetch(`${SF_AUTH_BASE}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptedRefresh,
      client_id: clientId,
      client_secret: clientSecret,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Salesforce token refresh failed: ${res.status} ${text}`);
  }

  const raw = await res.json();
  // Refresh response may not include refresh_token (Salesforce re-uses the existing one)
  const data = z
    .object({
      access_token: z.string(),
      instance_url: z.string(),
      expires_in: z.number().optional(),
    })
    .parse(raw);

  const expiresIn = data.expires_in ?? 7200;

  // Store new tokens encrypted
  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      accessToken: encrypt(data.access_token),
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      metadata: {
        ...((integration.metadata as Record<string, unknown>) ?? {}),
        instanceUrl: data.instance_url,
      },
    },
  });

  logger.debug("Salesforce token refreshed", {
    integrationId: integration.id,
  });

  return {
    accessToken: data.access_token,
    instanceUrl: data.instance_url,
  };
}

/** Resolve access token + instance URL for a workspace */
export async function getAccessTokenAndInstance(
  workspaceId: string,
): Promise<{ accessToken: string; instanceUrl: string }> {
  const integration = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId, type: "SALESFORCE" } },
  });

  if (!integration?.accessToken) {
    throw new Error("Salesforce not connected");
  }

  const metadata = (integration.metadata as Record<string, unknown>) ?? {};
  const instanceUrl = metadata.instanceUrl as string | undefined;
  if (!instanceUrl) {
    throw new Error("Salesforce instance URL missing — reconnect required");
  }

  // Auto-refresh if expires within 5 minutes
  if (
    integration.expiresAt &&
    integration.expiresAt.getTime() - Date.now() < 5 * 60 * 1000
  ) {
    return refreshAccessToken(integration);
  }

  return {
    accessToken: decrypt(integration.accessToken),
    instanceUrl,
  };
}

// ─── Fetch Helper ───────────────────────────────────────

async function salesforceFetch(
  instanceUrl: string,
  accessToken: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`${instanceUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Salesforce API error ${res.status}: ${text}`);
  }

  return res;
}

// ─── API Methods ────────────────────────────────────────

export async function searchContacts(
  instanceUrl: string,
  accessToken: string,
  emails: string[],
): Promise<SalesforceContact[]> {
  if (emails.length === 0) return [];

  const allContacts: SalesforceContact[] = [];

  // SOQL IN clause limited to ~4000 chars — batch in groups of 50
  for (let i = 0; i < emails.length; i += 50) {
    const batch = emails.slice(i, i + 50);
    const escaped = batch.map((e) => `'${e.replace(/'/g, "\\'")}'`).join(",");
    const soql = `SELECT Id, Email, FirstName, LastName, Account.Name, Title, Phone FROM Contact WHERE Email IN (${escaped})`;

    const res = await salesforceFetch(
      instanceUrl,
      accessToken,
      `/services/data/${SF_API_VERSION}/query?q=${encodeURIComponent(soql)}`,
    );

    const raw = await res.json();
    const data = SOQLResultSchema.parse(raw);

    for (const record of data.records) {
      allContacts.push({
        id: record.Id,
        email: record.Email ?? undefined,
        firstName: record.FirstName ?? undefined,
        lastName: record.LastName ?? undefined,
        company: record.Account?.Name ?? undefined,
        jobTitle: record.Title ?? undefined,
        phone: record.Phone ?? undefined,
      });
    }
  }

  return allContacts;
}

export async function createContact(
  instanceUrl: string,
  accessToken: string,
  properties: Record<string, string>,
): Promise<SalesforceContact> {
  const res = await salesforceFetch(
    instanceUrl,
    accessToken,
    `/services/data/${SF_API_VERSION}/sobjects/Contact`,
    {
      method: "POST",
      body: JSON.stringify(properties),
    },
  );

  const raw = await res.json();
  const result = CreateResultSchema.parse(raw);

  if (!result.success) {
    throw new Error("Salesforce createContact returned success=false");
  }

  // Fetch the created record to return full data
  const getRes = await salesforceFetch(
    instanceUrl,
    accessToken,
    `/services/data/${SF_API_VERSION}/sobjects/Contact/${result.id}?fields=Id,Email,FirstName,LastName,Title,Phone`,
  );

  const contact = await getRes.json();
  return {
    id: contact.Id as string,
    email: (contact.Email as string) ?? undefined,
    firstName: (contact.FirstName as string) ?? undefined,
    lastName: (contact.LastName as string) ?? undefined,
    jobTitle: (contact.Title as string) ?? undefined,
    phone: (contact.Phone as string) ?? undefined,
  };
}

export async function updateContact(
  instanceUrl: string,
  accessToken: string,
  contactId: string,
  properties: Record<string, string>,
): Promise<void> {
  // Salesforce PATCH returns 204 No Content on success
  await salesforceFetch(
    instanceUrl,
    accessToken,
    `/services/data/${SF_API_VERSION}/sobjects/Contact/${contactId}`,
    {
      method: "PATCH",
      body: JSON.stringify(properties),
    },
  );
}

// ─── Test Connection ────────────────────────────────────

export async function testConnection(
  instanceUrl: string,
  accessToken: string,
): Promise<boolean> {
  try {
    await salesforceFetch(
      instanceUrl,
      accessToken,
      `/services/data/${SF_API_VERSION}/`,
    );
    return true;
  } catch (err) {
    logger.warn("Salesforce connection test failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
