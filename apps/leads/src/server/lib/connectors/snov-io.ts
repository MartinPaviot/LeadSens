/**
 * Snov.io ESP Provider — implements ESPProvider via Snov.io API.
 *
 * API docs: https://snov.io/knowledgebase/category/api/
 * Auth: OAuth2 Client Credentials — exchange client_id + client_secret for a 1h Bearer token.
 *       Token endpoint: POST /v1/oauth/access_token
 *       Credentials stored as "client_id:client_secret" (split on use).
 *
 * Key endpoints:
 * - GET  /v1/get-user-campaigns                          — list campaigns
 * - GET  /v2/statistics/campaign-analytics?campaign_id=X  — campaign analytics
 * - POST /v1/add-prospect-to-list                        — add prospect to campaign's list
 * - POST /v1/change-recipient-status                     — pause/unsubscribe a recipient
 *
 * Rate limit: 60 req/min
 *
 * GOTCHA: Snov.io uses client_id + client_secret (NOT a single API key).
 * The credentials param is "client_id:client_secret" joined by colon.
 * Token is cached and refreshed when near expiry (5-min buffer).
 */

import { sleep } from "./fetch-retry";

import type {
  ESPProvider,
  ESPAccount,
  ESPCampaign,
  CreateCampaignParams,
  CampaignSendingStatus,
  CampaignAnalytics,
  StepAnalytics,
  LeadPerformancePage,
  AddLeadsResult,
  ESPLeadData,
  GetEmailsParams,
  GetEmailsResult,
  ReplyToEmailParams,
  ReplyToEmailResult,
  RemoveFromSequenceParams,
  RemoveFromSequenceResult,
} from "@/server/lib/providers/esp-provider";

const SNOV_BASE = "https://api.snov.io";
const MAX_RETRIES = 3;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

// ─── Credential Helpers ─────────────────────────────────

interface SnovCredentials {
  clientId: string;
  clientSecret: string;
}

function parseCredentials(credentials: string): SnovCredentials {
  const colonIndex = credentials.indexOf(":");
  if (colonIndex === -1) {
    throw new Error("Snov.io credentials must be 'client_id:client_secret'");
  }
  return {
    clientId: credentials.slice(0, colonIndex),
    clientSecret: credentials.slice(colonIndex + 1),
  };
}

// ─── Token Management ───────────────────────────────────

interface TokenCache {
  accessToken: string;
  expiresAt: number; // unix ms
}

async function getToken(creds: SnovCredentials): Promise<string> {
  const res = await fetch(`${SNOV_BASE}/v1/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Snov.io token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new Error("Snov.io token response missing access_token");
  }

  return data.access_token;
}

function createTokenManager(creds: SnovCredentials): {
  getValidToken: () => Promise<string>;
} {
  let cache: TokenCache | null = null;
  let pendingRefresh: Promise<string> | null = null;

  async function refresh(): Promise<string> {
    const token = await getToken(creds);
    cache = {
      accessToken: token,
      expiresAt: Date.now() + 3600 * 1000, // 1 hour
    };
    return token;
  }

  return {
    async getValidToken(): Promise<string> {
      if (cache && Date.now() < cache.expiresAt - TOKEN_REFRESH_BUFFER_MS) {
        return cache.accessToken;
      }

      // Deduplicate concurrent refresh calls
      if (!pendingRefresh) {
        pendingRefresh = refresh().finally(() => {
          pendingRefresh = null;
        });
      }

      return pendingRefresh;
    },
  };
}

// ─── API Helpers ────────────────────────────────────────

async function snovFetch(
  getValidToken: () => Promise<string>,
  path: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>,
): Promise<unknown> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const token = await getValidToken();

    const url = method === "GET" && !body
      ? `${SNOV_BASE}${path}`
      : `${SNOV_BASE}${path}`;

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (res.ok) {
      const contentType = res.headers.get("content-type");
      if (!contentType?.includes("application/json")) return {};
      return res.json();
    }

    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      await sleep(Math.pow(2, attempt) * 1000);
      continue;
    }

    const text = await res.text().catch(() => "");
    throw new Error(`Snov.io ${method} ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }

  throw new Error(`Snov.io ${method} ${path} failed after ${MAX_RETRIES} retries`);
}

// ─── Connection Test ────────────────────────────────────

export async function testSnovIoConnection(credentials: string): Promise<boolean> {
  try {
    const creds = parseCredentials(credentials);
    await getToken(creds);
    return true;
  } catch {
    return false;
  }
}

// ─── ESP Provider Implementation ────────────────────────

function notImplemented(method: string): never {
  throw new Error(`Snov.io does not support ${method} via API.`);
}

export function createSnovIoESP(credentials: string): ESPProvider {
  const creds = parseCredentials(credentials);
  const tokenManager = createTokenManager(creds);
  const { getValidToken } = tokenManager;

  // Cache campaign list_ids so we don't re-fetch on every addLeads call
  const listIdCache = new Map<string, number>();

  async function getCampaignListId(campaignId: string): Promise<number> {
    const cached = listIdCache.get(campaignId);
    if (cached !== undefined) return cached;

    const data = (await snovFetch(getValidToken, "/v1/get-user-campaigns")) as Array<{
      id: number;
      list_id?: number;
    }>;

    if (!Array.isArray(data)) {
      throw new Error("Snov.io get-user-campaigns returned unexpected format");
    }

    for (const c of data) {
      if (c.list_id !== undefined) {
        listIdCache.set(String(c.id), c.list_id);
      }
    }

    const listId = listIdCache.get(campaignId);
    if (listId === undefined) {
      throw new Error(`Snov.io campaign ${campaignId} not found or missing list_id`);
    }
    return listId;
  }

  return {
    name: "snov-io",

    async listAccounts(): Promise<ESPAccount[]> {
      notImplemented("listAccounts");
    },

    async createCampaign(_params: CreateCampaignParams): Promise<ESPCampaign> {
      throw new Error(
        "Campaigns must be created in the Snov.io UI. " +
          "Create a drip campaign there, then use its ID in LeadSens.",
      );
    },

    async activateCampaign(_campaignId: string): Promise<void> {
      notImplemented("activateCampaign");
    },

    async pauseCampaign(_campaignId: string): Promise<void> {
      notImplemented("pauseCampaign");
    },

    async getCampaignStatus(campaignId: string): Promise<CampaignSendingStatus> {
      const analytics = await this.getCampaignAnalytics(campaignId);
      return {
        campaignId,
        status: "unknown",
        sent: analytics.sent ?? 0,
        opened: analytics.opened ?? 0,
        replied: analytics.replied ?? 0,
        bounced: analytics.bounced ?? 0,
        raw: analytics.raw,
      };
    },

    async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
      const data = (await snovFetch(
        getValidToken,
        `/v2/statistics/campaign-analytics?campaign_id=${encodeURIComponent(campaignId)}`,
      )) as {
        emails_sent?: number;
        delivered?: number;
        bounced?: number;
        email_opens?: number;
        email_replies?: number;
        link_clicks?: number;
        unsubscribed?: number;
      };

      const sent = data.emails_sent ?? 0;

      return {
        campaignId,
        sent,
        opened: data.email_opens ?? 0,
        openRate: sent > 0 ? (data.email_opens ?? 0) / sent : undefined,
        replied: data.email_replies ?? 0,
        replyRate: sent > 0 ? (data.email_replies ?? 0) / sent : undefined,
        bounced: data.bounced ?? 0,
        clicked: data.link_clicks ?? 0,
        unsubscribed: data.unsubscribed ?? 0,
        raw: data,
      };
    },

    async getStepAnalytics(_campaignId: string): Promise<StepAnalytics[]> {
      // Snov.io campaign-analytics endpoint returns aggregate stats only, no per-step breakdown
      return [];
    },

    async getLeadsPerformance(
      _campaignId: string,
      _limit: number,
      _cursor?: string,
    ): Promise<LeadPerformancePage> {
      // Snov.io does not expose per-lead performance via API
      return { items: [] };
    },

    async addLeads(campaignId: string, leads: ESPLeadData[]): Promise<AddLeadsResult> {
      const listId = await getCampaignListId(campaignId);

      let added = 0;
      const errors: string[] = [];

      for (const lead of leads) {
        try {
          await snovFetch(getValidToken, "/v1/add-prospect-to-list", "POST", {
            email: lead.email,
            list_id: listId,
            first_name: lead.firstName ?? "",
            last_name: lead.lastName ?? "",
            companyName: lead.company ?? "",
            position: lead.customVariables?.position ?? "",
          });
          added++;
        } catch (err) {
          errors.push(
            `${lead.email}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      return {
        added,
        skipped: leads.length - added - errors.length,
        errors: errors.length > 0 ? errors : undefined,
      };
    },

    async getEmails(_params: GetEmailsParams): Promise<GetEmailsResult> {
      // Snov.io does not expose sent emails via API
      return { items: [], hasMore: false };
    },

    async replyToEmail(_params: ReplyToEmailParams): Promise<ReplyToEmailResult> {
      return {
        error:
          "Reply via API is not supported by Snov.io. Please reply from the Snov.io UI.",
      };
    },

    async removeFromSequence(
      params: RemoveFromSequenceParams,
    ): Promise<RemoveFromSequenceResult> {
      try {
        await snovFetch(getValidToken, "/v1/change-recipient-status", "POST", {
          email: params.leadEmail,
          campaignId: params.campaignId,
          status: "Paused",
        });
        return { removed: true };
      } catch (err) {
        return {
          removed: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },

    async disableVariant(
      _campaignId: string,
      _stepIndex: number,
      _variantIndex: number,
    ): Promise<boolean> {
      // Snov.io does not support variant management via API
      return false;
    },
  };
}
