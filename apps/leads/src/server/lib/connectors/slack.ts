/**
 * Slack Connector — OAuth helpers + NotificationProvider implementation.
 *
 * Auth: OAuth 2.0 (bot token, no refresh needed — bot tokens don't expire)
 * API docs: https://api.slack.com/methods
 *
 * Key endpoints:
 * - POST https://slack.com/api/oauth.v2.access  — exchange code for bot token
 * - POST https://slack.com/api/auth.test         — test connection
 * - POST https://slack.com/api/chat.postMessage   — send message to channel
 * - GET  https://slack.com/api/conversations.list — list channels
 *
 * Bot scopes: chat:write, channels:read
 */

import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import type { NotificationProvider, NotificationMessage } from "../providers/notification-provider";

const SLACK_AUTH_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";
const SLACK_API = "https://slack.com/api";
const API_TIMEOUT = 15_000;

// ─── API Response Schemas ───────────────────────────────

const oauthResponseSchema = z.object({
  ok: z.boolean(),
  access_token: z.string().optional(),
  team: z.object({ name: z.string() }).optional(),
  error: z.string().optional(),
});

const authTestSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
});

const postMessageSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  ts: z.string().optional(),
});

const conversationsListSchema = z.object({
  ok: z.boolean(),
  channels: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      is_member: z.boolean().optional(),
      is_archived: z.boolean().optional(),
    }),
  ).optional(),
  error: z.string().optional(),
});

// ─── OAuth Helpers ──────────────────────────────────────

export function getAuthUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "chat:write,channels:read",
    response_type: "code",
  });
  return `${SLACK_AUTH_URL}?${params}`;
}

export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{ accessToken: string; teamName?: string }> {
  const res = await fetch(SLACK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(API_TIMEOUT),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Slack OAuth exchange failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  const data = oauthResponseSchema.parse(json);

  if (!data.ok || !data.access_token) {
    throw new Error(`Slack OAuth exchange failed: ${data.error ?? "no access_token"}`);
  }

  return {
    accessToken: data.access_token,
    teamName: data.team?.name,
  };
}

// ─── API Helpers ────────────────────────────────────────

async function slackFetch(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(API_TIMEOUT),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Slack ${method} returned ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

// ─── Connection Test ────────────────────────────────────

export async function testSlackConnection(token: string): Promise<boolean> {
  try {
    const json = await slackFetch(token, "auth.test");
    const data = authTestSchema.safeParse(json);
    return data.success && data.data.ok;
  } catch {
    return false;
  }
}

// ─── Channel Discovery ─────────────────────────────────

async function findDefaultChannel(token: string): Promise<string | undefined> {
  try {
    const json = await slackFetch(token, "conversations.list", {
      types: "public_channel",
      limit: 200,
      exclude_archived: true,
    });

    const data = conversationsListSchema.parse(json);
    if (!data.ok || !data.channels) return undefined;

    // Prefer #leadsens, then #general
    const leadsens = data.channels.find((c) => c.name === "leadsens" && !c.is_archived);
    if (leadsens) return leadsens.id;

    const general = data.channels.find((c) => c.name === "general" && !c.is_archived);
    if (general) return general.id;

    return undefined;
  } catch (err) {
    logger.warn("Slack findDefaultChannel failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

// ─── Access Token ───────────────────────────────────────

async function getAccessToken(workspaceId: string): Promise<string> {
  const integration = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId, type: "SLACK" } },
  });

  if (!integration?.accessToken) {
    throw new Error("Slack not connected");
  }

  // Bot tokens don't expire — no refresh needed
  return decrypt(integration.accessToken);
}

// ─── NotificationProvider Implementation ────────────────

export function createSlackNotification(workspaceId: string): NotificationProvider {
  // Cache the resolved default channel per provider instance
  let cachedDefaultChannel: string | undefined;

  return {
    name: "slack",

    async send(message: NotificationMessage): Promise<{ ok: boolean; error?: string }> {
      try {
        const token = await getAccessToken(workspaceId);

        let channel = message.channel;

        // If no channel specified, find a default
        if (!channel) {
          if (cachedDefaultChannel === undefined) {
            cachedDefaultChannel = (await findDefaultChannel(token)) ?? "";
          }
          channel = cachedDefaultChannel || undefined;
        }

        if (!channel) {
          return { ok: false, error: "No channel specified and no #leadsens or #general channel found" };
        }

        const json = await slackFetch(token, "chat.postMessage", {
          channel,
          text: message.text,
          ...(message.metadata ? { metadata: { event_type: "leadsens_notification", event_payload: message.metadata } } : {}),
        });

        const data = postMessageSchema.parse(json);

        if (!data.ok) {
          logger.warn("Slack chat.postMessage failed", { error: data.error, channel });
          return { ok: false, error: data.error ?? "unknown error" };
        }

        return { ok: true };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error("Slack notification send failed", {
          error: errorMsg,
          workspaceId,
          channel: message.channel,
        });
        return { ok: false, error: errorMsg };
      }
    },
  };
}
