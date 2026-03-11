/**
 * Mailshake ESP Provider — implements ESPProvider via Mailshake API.
 *
 * API docs: https://mailshake.com/api/
 * Auth: Basic auth `Authorization: Basic base64(apiKey:)` (key as username, empty password)
 *
 * Key endpoints:
 * - GET  /me                 — test connection
 * - GET  /senders/list       — list sender accounts
 * - POST /campaigns/create   — create campaign
 * - POST /campaigns/pause    — pause campaign
 * - POST /campaigns/unpause  — unpause campaign
 * - POST /leads/add          — add leads to campaign
 * - GET  /leads/list         — get leads performance
 * - GET  /activity/sent      — get sent emails
 * - GET  /activity/replies   — get replies
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

const MS_BASE = "https://api.mailshake.com/2017-04-01";
const MAX_RETRIES = 3;

// ─── API Helpers ────────────────────────────────────────

function authHeader(apiKey: string): string {
  // Mailshake: Basic auth with API key as username, empty password
  const encoded = Buffer.from(`${apiKey}:`).toString("base64");
  return `Basic ${encoded}`;
}

async function msFetch(
  apiKey: string,
  path: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>,
): Promise<unknown> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${MS_BASE}${path}`, {
      method,
      headers: {
        Authorization: authHeader(apiKey),
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
    throw new Error(`Mailshake ${method} ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }

  throw new Error(`Mailshake ${method} ${path} failed after ${MAX_RETRIES} retries`);
}

// ─── Connection Test ────────────────────────────────────

export async function testMailshakeConnection(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${MS_BASE}/me`, {
      headers: { Authorization: authHeader(apiKey) },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── ESP Provider Implementation ────────────────────────

export function createMailshakeESP(apiKey: string): ESPProvider {
  return {
    name: "mailshake",

    async listAccounts(): Promise<ESPAccount[]> {
      const data = (await msFetch(apiKey, "/senders/list")) as {
        results?: Array<{
          id: number;
          emailAddress: string;
          fromName?: string;
          isPaused?: boolean;
        }>;
      };

      if (!data.results || !Array.isArray(data.results)) return [];

      return data.results.map((s) => ({
        email: s.emailAddress,
        name: s.fromName ?? undefined,
        status: s.isPaused ? "paused" : "active",
      }));
    },

    async createCampaign(params: CreateCampaignParams): Promise<ESPCampaign> {
      // Mailshake creates campaigns with messages inline
      const messages = params.steps.map((step, idx) => ({
        subject: idx === 0 ? step.subject : undefined,
        body: step.body,
        delay: idx === 0 ? 0 : step.delay,
        isFollowUp: idx > 0,
      }));

      const campaign = (await msFetch(apiKey, "/campaigns/create", "POST", {
        name: params.name,
        messages,
        ...(params.accountEmails.length > 0 ? { senderEmailAddress: params.accountEmails[0] } : {}),
      })) as { campaignID: number; name?: string };

      return { id: String(campaign.campaignID), name: params.name, status: "draft" };
    },

    async activateCampaign(campaignId: string): Promise<void> {
      await msFetch(apiKey, "/campaigns/unpause", "POST", {
        campaignID: parseInt(campaignId, 10),
      });
    },

    async pauseCampaign(campaignId: string): Promise<void> {
      await msFetch(apiKey, "/campaigns/pause", "POST", {
        campaignID: parseInt(campaignId, 10),
      });
    },

    async getCampaignStatus(campaignId: string): Promise<CampaignSendingStatus> {
      const data = (await msFetch(apiKey, `/campaigns/get?campaignID=${campaignId}`)) as {
        isPaused?: boolean;
        numSent?: number;
        numOpened?: number;
        numReplied?: number;
        numBounced?: number;
      };

      return {
        campaignId,
        status: data.isPaused ? "paused" : "active",
        sent: data.numSent ?? 0,
        opened: data.numOpened ?? 0,
        replied: data.numReplied ?? 0,
        bounced: data.numBounced ?? 0,
        raw: data,
      };
    },

    async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
      const data = (await msFetch(apiKey, `/campaigns/get?campaignID=${campaignId}`)) as {
        numSent?: number;
        numOpened?: number;
        numClicked?: number;
        numReplied?: number;
        numBounced?: number;
        numUnsubscribed?: number;
      };

      const sent = data.numSent ?? 0;

      return {
        campaignId,
        sent,
        opened: data.numOpened ?? 0,
        openRate: sent > 0 ? (data.numOpened ?? 0) / sent : undefined,
        replied: data.numReplied ?? 0,
        replyRate: sent > 0 ? (data.numReplied ?? 0) / sent : undefined,
        bounced: data.numBounced ?? 0,
        clicked: data.numClicked ?? 0,
        unsubscribed: data.numUnsubscribed ?? 0,
        raw: data,
      };
    },

    async getStepAnalytics(_campaignId: string): Promise<StepAnalytics[]> {
      // Mailshake does not expose per-step analytics via API
      return [];
    },

    async getLeadsPerformance(campaignId: string, limit: number, cursor?: string): Promise<LeadPerformancePage> {
      const nextToken = cursor ?? undefined;
      const data = (await msFetch(
        apiKey,
        `/leads/list?campaignID=${campaignId}&perPage=${limit}${nextToken ? `&nextToken=${nextToken}` : ""}`,
      )) as {
        results?: Array<{
          id: number;
          emailAddress: string;
          opens?: number;
          replies?: number;
          clicks?: number;
          lastOpenedAt?: string;
          lastRepliedAt?: string;
        }>;
        nextToken?: string;
      };

      if (!data.results || !Array.isArray(data.results)) return { items: [] };

      const items = data.results.map((l) => ({
        id: String(l.id),
        email: l.emailAddress,
        openCount: l.opens ?? 0,
        replyCount: l.replies ?? 0,
        clickCount: l.clicks ?? 0,
        interestStatus: null,
        lastOpenAt: l.lastOpenedAt ?? null,
        lastReplyAt: l.lastRepliedAt ?? null,
      }));

      return {
        items,
        nextCursor: data.nextToken ?? undefined,
      };
    },

    async addLeads(campaignId: string, leads: ESPLeadData[]): Promise<AddLeadsResult> {
      const recipients = leads.map((lead) => ({
        emailAddress: lead.email,
        fullName: [lead.firstName, lead.lastName].filter(Boolean).join(" ") || undefined,
        fields: {
          company: lead.company ?? "",
          ...(lead.customVariables ?? {}),
        },
      }));

      const result = (await msFetch(apiKey, "/leads/add", "POST", {
        campaignID: parseInt(campaignId, 10),
        addAsNewList: true,
        recipients,
      })) as { addedCount?: number; duplicateCount?: number };

      return {
        added: result.addedCount ?? leads.length,
        skipped: result.duplicateCount ?? 0,
      };
    },

    async getEmails(params: GetEmailsParams): Promise<GetEmailsResult> {
      if (!params.campaignId) {
        return { items: [], hasMore: false };
      }

      const endpoint = params.emailType === "received" ? "/activity/replies" : "/activity/sent";
      const data = (await msFetch(
        apiKey,
        `${endpoint}?campaignID=${params.campaignId}&perPage=${params.limit ?? 50}`,
      )) as {
        results?: Array<{
          id: number;
          to?: string;
          from?: string;
          subject?: string;
          preview?: string;
          actionDate?: string;
          isAutoReply?: boolean;
        }>;
        nextToken?: string;
      };

      if (!data.results || !Array.isArray(data.results)) return { items: [], hasMore: false };

      const items = data.results.map((a) => ({
        id: String(a.id),
        from: a.from ?? undefined,
        to: a.to ?? undefined,
        subject: a.subject ?? undefined,
        preview: a.preview ?? undefined,
        timestamp: a.actionDate ?? undefined,
        isAutoReply: a.isAutoReply ?? false,
      }));

      return {
        items,
        hasMore: !!data.nextToken,
      };
    },

    async replyToEmail(_params: ReplyToEmailParams): Promise<ReplyToEmailResult> {
      return { error: "Reply via API is not supported by Mailshake. Please reply from the Mailshake UI." };
    },

    async removeFromSequence(params: RemoveFromSequenceParams): Promise<RemoveFromSequenceResult> {
      try {
        await msFetch(apiKey, "/leads/pause", "POST", {
          campaignID: parseInt(params.campaignId, 10),
          emailAddresses: [params.leadEmail],
        });
        return { removed: true };
      } catch (err) {
        return { removed: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async disableVariant(_campaignId: string, _stepIndex: number, _variantIndex: number): Promise<boolean> {
      return false;
    },
  };
}
