/**
 * Woodpecker ESP Provider — implements ESPProvider via Woodpecker API v2.
 *
 * API docs: https://woodpecker.co/docs/api/v2/
 * Auth: `x-api-key: API_KEY` header
 *
 * Key endpoints:
 * - GET  /rest/v2/mail_accounts           — list email accounts
 * - POST /rest/v2/campaigns               — create campaign
 * - POST /rest/v2/campaigns/{id}/emails   — add email steps
 * - PATCH /rest/v2/campaigns/{id}         — update status (active/paused)
 * - GET  /rest/v2/campaigns/{id}/statistics — campaign analytics
 * - POST /rest/v2/campaigns/{id}/prospects — add leads (batch)
 * - GET  /rest/v2/campaigns/{id}/prospects — get leads performance
 * - GET  /rest/v2/campaigns/{id}/emails   — get sent emails
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

const WP_BASE = "https://api.woodpecker.co/rest/v2";
const MAX_RETRIES = 3;

// ─── API Helpers ────────────────────────────────────────

async function wpFetch(
  apiKey: string,
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: Record<string, unknown>,
): Promise<unknown> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${WP_BASE}${path}`, {
      method,
      headers: {
        "x-api-key": apiKey,
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
    throw new Error(`Woodpecker ${method} ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }

  throw new Error(`Woodpecker ${method} ${path} failed after ${MAX_RETRIES} retries`);
}

// ─── Connection Test ────────────────────────────────────

export async function testWoodpeckerConnection(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${WP_BASE}/mail_accounts`, {
      headers: { "x-api-key": apiKey },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── ESP Provider Implementation ────────────────────────

export function createWoodpeckerESP(apiKey: string): ESPProvider {
  return {
    name: "woodpecker",

    async listAccounts(): Promise<ESPAccount[]> {
      const data = (await wpFetch(apiKey, "/mail_accounts")) as Array<{
        id: number;
        email: string;
        name?: string;
        is_connected?: boolean;
        daily_limit?: number;
      }>;

      if (!Array.isArray(data)) return [];

      return data.map((a) => ({
        email: a.email,
        name: a.name ?? undefined,
        status: a.is_connected !== false ? "active" : "inactive",
        dailySendLimit: a.daily_limit ?? undefined,
      }));
    },

    async createCampaign(params: CreateCampaignParams): Promise<ESPCampaign> {
      // Step 1: Create the campaign
      const campaign = (await wpFetch(apiKey, "/campaigns", "POST", {
        name: params.name,
      })) as { id: number; name: string };

      const campaignId = String(campaign.id);

      // Step 2: Add email steps
      for (let i = 0; i < params.steps.length; i++) {
        const step = params.steps[i];
        await wpFetch(apiKey, `/campaigns/${campaignId}/emails`, "POST", {
          subject: step.subject,
          body: step.body,
          delay: i === 0 ? 0 : step.delay,
        });
      }

      // Step 3: Assign email accounts
      if (params.accountEmails.length > 0) {
        const accounts = (await wpFetch(apiKey, "/mail_accounts")) as Array<{
          id: number;
          email: string;
        }>;
        const emailToId = new Map(
          (Array.isArray(accounts) ? accounts : []).map((a) => [a.email.toLowerCase(), a.id]),
        );

        const accountIds = params.accountEmails
          .map((e) => emailToId.get(e.toLowerCase()))
          .filter((id): id is number => id !== undefined);

        if (accountIds.length > 0) {
          await wpFetch(apiKey, `/campaigns/${campaignId}`, "PATCH", {
            mail_account_ids: accountIds,
            ...(params.dailyLimit ? { daily_limit: params.dailyLimit } : {}),
          });
        }
      }

      return { id: campaignId, name: params.name, status: "draft" };
    },

    async activateCampaign(campaignId: string): Promise<void> {
      await wpFetch(apiKey, `/campaigns/${campaignId}`, "PATCH", {
        status: "active",
      });
    },

    async pauseCampaign(campaignId: string): Promise<void> {
      await wpFetch(apiKey, `/campaigns/${campaignId}`, "PATCH", {
        status: "paused",
      });
    },

    async getCampaignStatus(campaignId: string): Promise<CampaignSendingStatus> {
      const data = (await wpFetch(apiKey, `/campaigns/${campaignId}/statistics`)) as {
        sent?: number;
        opened?: number;
        replied?: number;
        bounced?: number;
        status?: string;
      };

      return {
        campaignId,
        status: data.status ?? "unknown",
        sent: data.sent ?? 0,
        opened: data.opened ?? 0,
        replied: data.replied ?? 0,
        bounced: data.bounced ?? 0,
        raw: data,
      };
    },

    async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
      const data = (await wpFetch(apiKey, `/campaigns/${campaignId}/statistics`)) as {
        sent?: number;
        opened?: number;
        clicked?: number;
        replied?: number;
        bounced?: number;
        unsubscribed?: number;
      };

      const sent = data.sent ?? 0;

      return {
        campaignId,
        sent,
        opened: data.opened ?? 0,
        openRate: sent > 0 ? (data.opened ?? 0) / sent : undefined,
        replied: data.replied ?? 0,
        replyRate: sent > 0 ? (data.replied ?? 0) / sent : undefined,
        bounced: data.bounced ?? 0,
        clicked: data.clicked ?? 0,
        unsubscribed: data.unsubscribed ?? 0,
        raw: data,
      };
    },

    async getStepAnalytics(campaignId: string): Promise<StepAnalytics[]> {
      const data = (await wpFetch(apiKey, `/campaigns/${campaignId}/statistics`)) as {
        steps?: Array<{
          step_number?: number;
          sent?: number;
          opened?: number;
          replied?: number;
          bounced?: number;
        }>;
      };

      if (!data.steps || !Array.isArray(data.steps)) return [];

      return data.steps.map((s) => ({
        step: (s.step_number ?? 1) - 1,
        sent: s.sent ?? 0,
        opened: s.opened ?? 0,
        replied: s.replied ?? 0,
        bounced: s.bounced ?? 0,
      }));
    },

    async getLeadsPerformance(campaignId: string, limit: number, cursor?: string): Promise<LeadPerformancePage> {
      const page = cursor ? parseInt(cursor, 10) : 1;
      const data = (await wpFetch(
        apiKey,
        `/campaigns/${campaignId}/prospects?per_page=${limit}&page=${page}`,
      )) as Array<{
        id: number;
        email: string;
        status?: string;
        opens?: number;
        replies?: number;
        clicks?: number;
        last_opened_at?: string;
        last_replied_at?: string;
      }>;

      if (!Array.isArray(data)) return { items: [] };

      const items = data.map((l) => ({
        id: String(l.id),
        email: l.email,
        openCount: l.opens ?? 0,
        replyCount: l.replies ?? 0,
        clickCount: l.clicks ?? 0,
        interestStatus: null,
        lastOpenAt: l.last_opened_at ?? null,
        lastReplyAt: l.last_replied_at ?? null,
      }));

      return {
        items,
        nextCursor: items.length >= limit ? String(page + 1) : undefined,
      };
    },

    async addLeads(campaignId: string, leads: ESPLeadData[]): Promise<AddLeadsResult> {
      const prospects = leads.map((lead) => ({
        ...(lead.customVariables ?? {}),
        email: lead.email,
        first_name: lead.firstName ?? "",
        last_name: lead.lastName ?? "",
        company: lead.company ?? "",
      }));

      const result = (await wpFetch(apiKey, `/campaigns/${campaignId}/prospects`, "POST", {
        prospects,
      })) as { added?: number; duplicates?: number };

      return {
        added: result.added ?? leads.length,
        skipped: result.duplicates ?? 0,
      };
    },

    async getEmails(params: GetEmailsParams): Promise<GetEmailsResult> {
      if (!params.campaignId) {
        return { items: [], hasMore: false };
      }

      const data = (await wpFetch(
        apiKey,
        `/campaigns/${params.campaignId}/prospects?per_page=${params.limit ?? 50}`,
      )) as Array<{
        id: number;
        email: string;
        emails_sent?: Array<{
          id: number;
          subject?: string;
          body_preview?: string;
          sent_at?: string;
        }>;
      }>;

      if (!Array.isArray(data)) return { items: [], hasMore: false };

      const items = data.flatMap((lead) =>
        (lead.emails_sent ?? []).map((e) => ({
          id: String(e.id),
          from: undefined,
          to: lead.email,
          subject: e.subject ?? undefined,
          preview: e.body_preview ?? undefined,
          timestamp: e.sent_at ?? undefined,
          isAutoReply: false,
        })),
      );

      return {
        items: items.slice(0, params.limit ?? 50),
        hasMore: items.length > (params.limit ?? 50),
      };
    },

    async replyToEmail(_params: ReplyToEmailParams): Promise<ReplyToEmailResult> {
      return { error: "Reply via API is not supported by Woodpecker. Please reply from the Woodpecker UI." };
    },

    async removeFromSequence(params: RemoveFromSequenceParams): Promise<RemoveFromSequenceResult> {
      try {
        await wpFetch(
          apiKey,
          `/campaigns/${params.campaignId}/prospects/${encodeURIComponent(params.leadEmail)}`,
          "DELETE",
        );
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
