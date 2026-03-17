/**
 * Calendly Scheduling Provider — implements SchedulingProvider via Calendly API v2.
 *
 * API docs: https://developer.calendly.com/api-docs
 * Base URL: https://api.calendly.com
 * Auth: OAuth2 (Authorization Code)
 *
 * Key concepts:
 * - User URI from /users/me (e.g. "https://api.calendly.com/users/XXXX")
 * - Event types = scheduling link templates (1:1, group, round-robin)
 * - Each event type has a `scheduling_url` for embedding/sharing
 * - Duration is in minutes
 *
 * OAuth flow: auth.calendly.com/oauth/authorize → auth.calendly.com/oauth/token
 */

import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import type {
  SchedulingProvider,
  SchedulingLink,
} from "@/server/lib/providers/scheduling-provider";

const CALENDLY_BASE = "https://api.calendly.com";
const CALENDLY_AUTH_BASE = "https://auth.calendly.com";
const REQUEST_TIMEOUT = 15_000;

// ─── Zod schemas for API response validation ─────────────

const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  token_type: z.string(),
});

const userSchema = z.object({
  resource: z.object({
    uri: z.string(),
    name: z.string().optional(),
    email: z.string().optional(),
  }),
});

const eventTypeSchema = z.object({
  uri: z.string(),
  name: z.string(),
  slug: z.string().optional(),
  scheduling_url: z.string(),
  duration: z.number().optional(),
  active: z.boolean().optional(),
});

const eventTypesResponseSchema = z.object({
  collection: z.array(eventTypeSchema),
  pagination: z.object({
    count: z.number(),
    next_page_token: z.string().nullable().optional(),
  }).optional(),
});

// ─── OAuth helpers ───────────────────────────────────────

export function getAuthUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
  });
  return `${CALENDLY_AUTH_BASE}/oauth/authorize?${params}`;
}

export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const res = await fetch(`${CALENDLY_AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendly OAuth exchange failed: ${res.status} ${text}`);
  }

  const raw = await res.json();
  const data = tokenResponseSchema.parse(raw);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

// ─── Token management ────────────────────────────────────

async function refreshAccessToken(integration: {
  id: string;
  refreshToken: string | null;
}): Promise<string> {
  if (!integration.refreshToken) {
    throw new Error("No refresh token available for Calendly");
  }

  const clientId = process.env.CALENDLY_CLIENT_ID;
  const clientSecret = process.env.CALENDLY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Calendly OAuth credentials not configured");
  }

  const decryptedRefresh = decrypt(integration.refreshToken);

  const res = await fetch(`${CALENDLY_AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptedRefresh,
      client_id: clientId,
      client_secret: clientSecret,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendly token refresh failed: ${res.status} ${text}`);
  }

  const raw = await res.json();
  const data = tokenResponseSchema.parse(raw);

  // Store new tokens encrypted
  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      accessToken: encrypt(data.access_token),
      refreshToken: encrypt(data.refresh_token),
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return data.access_token;
}

async function getAccessToken(workspaceId: string): Promise<string> {
  const integration = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId, type: "CALENDLY" } },
  });

  if (!integration?.accessToken) {
    throw new Error("Calendly not connected");
  }

  // Auto-refresh if expires within 5 minutes
  if (integration.expiresAt && integration.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    return refreshAccessToken(integration);
  }

  return decrypt(integration.accessToken);
}

// ─── API client ──────────────────────────────────────────

async function calendlyFetch(
  accessToken: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`${CALENDLY_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendly API error ${res.status}: ${text}`);
  }

  return res;
}

// ─── SchedulingProvider ──────────────────────────────────

class CalendlyScheduling implements SchedulingProvider {
  readonly name = "Calendly";

  constructor(private readonly workspaceId: string) {}

  async getLinks(): Promise<SchedulingLink[]> {
    try {
      const accessToken = await getAccessToken(this.workspaceId);

      // Step 1: Get user URI from /users/me
      const meRes = await calendlyFetch(accessToken, "/users/me");
      const meRaw = await meRes.json();
      const me = userSchema.parse(meRaw);
      const userUri = me.resource.uri;

      // Step 2: Get event types for this user
      const params = new URLSearchParams({ user: userUri });
      const eventsRes = await calendlyFetch(accessToken, `/event_types?${params}`);
      const eventsRaw = await eventsRes.json();
      const events = eventTypesResponseSchema.parse(eventsRaw);

      return events.collection
        .filter((et) => et.active !== false)
        .map((et) => ({
          url: et.scheduling_url,
          name: et.name,
          duration: et.duration,
        }));
    } catch (err) {
      logger.error("Calendly getLinks failed", {
        workspaceId: this.workspaceId,
        error: err instanceof Error ? err.message : "unknown",
      });
      throw err;
    }
  }

  async getLink(idOrSlug: string): Promise<SchedulingLink | null> {
    try {
      const links = await this.getLinks();
      const needle = idOrSlug.toLowerCase();

      return (
        links.find(
          (link) =>
            link.url.toLowerCase().includes(needle) ||
            link.name.toLowerCase() === needle,
        ) ?? null
      );
    } catch (err) {
      logger.error("Calendly getLink failed", {
        workspaceId: this.workspaceId,
        idOrSlug,
        error: err instanceof Error ? err.message : "unknown",
      });
      throw err;
    }
  }
}

// ─── Factory ─────────────────────────────────────────────

export function createCalendlyScheduling(workspaceId: string): SchedulingProvider {
  return new CalendlyScheduling(workspaceId);
}
