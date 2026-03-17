import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

const HUBSPOT_BASE = "https://api.hubapi.com";

interface HubSpotContact {
  id: string;
  properties: Record<string, string | null>;
}

interface HubSpotSearchResult {
  total: number;
  results: HubSpotContact[];
}

// ─── OAuth helpers ───────────────────────────────────────

export function getAuthUrl(clientId: string, redirectUri: string, scopes: string[]): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    response_type: "code",
  });
  return `https://app.hubspot.com/oauth/authorize?${params}`;
}

export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const res = await fetch(`${HUBSPOT_BASE}/oauth/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot OAuth exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

async function refreshAccessToken(integration: {
  id: string;
  refreshToken: string | null;
}): Promise<string> {
  if (!integration.refreshToken) {
    throw new Error("No refresh token available for HubSpot");
  }

  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("HubSpot OAuth credentials not configured");
  }

  const decryptedRefresh = decrypt(integration.refreshToken);

  const res = await fetch(`${HUBSPOT_BASE}/oauth/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptedRefresh,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`HubSpot token refresh failed: ${res.status}`);
  }

  const data = await res.json();

  // Store new tokens encrypted
  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      accessToken: encrypt(data.access_token),
      refreshToken: encrypt(data.refresh_token),
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return data.access_token as string;
}

// ─── Client ──────────────────────────────────────────────

async function getAccessToken(workspaceId: string): Promise<string> {
  const integration = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId, type: "HUBSPOT" } },
  });

  if (!integration?.accessToken) {
    throw new Error("HubSpot not connected");
  }

  // Auto-refresh if expires within 5 minutes
  if (integration.expiresAt && integration.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    return refreshAccessToken(integration);
  }

  return decrypt(integration.accessToken);
}

async function hubspotFetch(
  accessToken: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`${HUBSPOT_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot API error ${res.status}: ${text}`);
  }

  return res;
}

// ─── API Methods ─────────────────────────────────────────

export async function searchContacts(
  workspaceId: string,
  emails: string[],
): Promise<HubSpotContact[]> {
  const accessToken = await getAccessToken(workspaceId);
  const allContacts: HubSpotContact[] = [];

  // Batch in groups of 50 (HubSpot limit)
  for (let i = 0; i < emails.length; i += 50) {
    const batch = emails.slice(i, i + 50);
    const res = await hubspotFetch(accessToken, "/crm/v3/objects/contacts/search", {
      method: "POST",
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: "email",
                operator: "IN",
                values: batch,
              },
            ],
          },
        ],
        properties: ["email", "firstname", "lastname", "company"],
        limit: 100,
      }),
    });

    const data: HubSpotSearchResult = await res.json();
    allContacts.push(...data.results);
  }

  return allContacts;
}

export async function createContact(
  workspaceId: string,
  properties: Record<string, string>,
): Promise<HubSpotContact> {
  const accessToken = await getAccessToken(workspaceId);
  const res = await hubspotFetch(accessToken, "/crm/v3/objects/contacts", {
    method: "POST",
    body: JSON.stringify({ properties }),
  });
  return res.json();
}

export async function updateContact(
  workspaceId: string,
  contactId: string,
  properties: Record<string, string>,
): Promise<HubSpotContact> {
  const accessToken = await getAccessToken(workspaceId);
  const res = await hubspotFetch(accessToken, `/crm/v3/objects/contacts/${contactId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
  return res.json();
}
