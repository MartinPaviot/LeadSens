/**
 * Reply.io ESP Provider — implements ESPProvider via Reply.io API v2.
 *
 * API docs: https://apidocs.reply.io/
 * Auth: `x-api-key: API_KEY` header
 *
 * Key endpoints:
 * - GET  /v2/emailAccounts             — list email accounts
 * - POST /v2/campaigns                 — create campaign
 * - POST /v2/campaigns/{id}/steps      — add steps to campaign
 * - PUT  /v2/campaigns/{id}/start      — activate campaign
 * - PUT  /v2/campaigns/{id}/pause      — pause campaign
 * - GET  /v2/campaigns/{id}            — get campaign details + status
 * - GET  /v2/campaigns/{id}/statistics — campaign analytics
 * - POST /v2/campaigns/{id}/people     — add leads (people)
 * - GET  /v2/activities                — get email activities
 * - POST /v2/activities/reply          — reply to an email
 * - DELETE /v2/campaigns/{id}/people/{personId} — remove from sequence
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

const RIO_BASE = "https://api.reply.io/v2";
const MAX_RETRIES = 3;

// ─── API Helpers ────────────────────────────────────────

async function rioFetch(
  apiKey: string,
  path: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  body?: Record<string, unknown>,
): Promise<unknown> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${RIO_BASE}${path}`, {
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
    throw new Error(`Reply.io ${method} ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }

  throw new Error(`Reply.io ${method} ${path} failed after ${MAX_RETRIES} retries`);
}

// ─── Connection Test ────────────────────────────────────

export async function testReplyIoConnection(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${RIO_BASE}/emailAccounts`, {
      headers: { "x-api-key": apiKey },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── ESP Provider Implementation ────────────────────────

export function createReplyIoESP(apiKey: string): ESPProvider {
  return {
    name: "reply_io",

    async listAccounts(): Promise<ESPAccount[]> {
      const data = (await rioFetch(apiKey, "/emailAccounts")) as Array<{
        id: number;
        email: string;
        name?: string;
        isActive?: boolean;
        dailyLimit?: number;
      }>;

      if (!Array.isArray(data)) return [];

      return data.map((a) => ({
        email: a.email,
        name: a.name ?? undefined,
        status: a.isActive !== false ? "active" : "inactive",
        dailySendLimit: a.dailyLimit ?? undefined,
      }));
    },

    async createCampaign(params: CreateCampaignParams): Promise<ESPCampaign> {
      // Step 1: Create the campaign
      const campaign = (await rioFetch(apiKey, "/campaigns", "POST", {
        name: params.name,
      })) as { id: number; name: string };

      const campaignId = String(campaign.id);

      // Step 2: Add email steps
      for (let i = 0; i < params.steps.length; i++) {
        const step = params.steps[i];
        await rioFetch(apiKey, `/campaigns/${campaignId}/steps`, "POST", {
          type: "email",
          subject: step.subject,
          body: step.body,
          delay: i === 0 ? 0 : step.delay,
          delayUnit: "day",
        });
      }

      // Step 3: Assign email accounts
      if (params.accountEmails.length > 0) {
        const accounts = (await rioFetch(apiKey, "/emailAccounts")) as Array<{
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
          await rioFetch(apiKey, `/campaigns/${campaignId}`, "PATCH", {
            emailAccountIds: accountIds,
            ...(params.dailyLimit ? { dailyLimit: params.dailyLimit } : {}),
          });
        }
      }

      return { id: campaignId, name: params.name, status: "draft" };
    },

    async activateCampaign(campaignId: string): Promise<void> {
      await rioFetch(apiKey, `/campaigns/${campaignId}/start`, "PUT");
    },

    async pauseCampaign(campaignId: string): Promise<void> {
      await rioFetch(apiKey, `/campaigns/${campaignId}/pause`, "PUT");
    },

    async getCampaignStatus(campaignId: string): Promise<CampaignSendingStatus> {
      const data = (await rioFetch(apiKey, `/campaigns/${campaignId}`)) as {
        id: number;
        name?: string;
        status?: string;
        statistics?: {
          sent?: number;
          opened?: number;
          replied?: number;
          bounced?: number;
        };
      };

      return {
        campaignId,
        status: data.status ?? "unknown",
        sent: data.statistics?.sent ?? 0,
        opened: data.statistics?.opened ?? 0,
        replied: data.statistics?.replied ?? 0,
        bounced: data.statistics?.bounced ?? 0,
        raw: data,
      };
    },

    async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
      const data = (await rioFetch(apiKey, `/campaigns/${campaignId}/statistics`)) as {
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
      const data = (await rioFetch(apiKey, `/campaigns/${campaignId}/statistics`)) as {
        steps?: Array<{
          stepNumber?: number;
          sent?: number;
          opened?: number;
          replied?: number;
          bounced?: number;
        }>;
      };

      if (!data.steps || !Array.isArray(data.steps)) return [];

      return data.steps.map((s) => ({
        step: (s.stepNumber ?? 1) - 1,
        sent: s.sent ?? 0,
        opened: s.opened ?? 0,
        replied: s.replied ?? 0,
        bounced: s.bounced ?? 0,
      }));
    },

    async getLeadsPerformance(campaignId: string, limit: number, cursor?: string): Promise<LeadPerformancePage> {
      const page = cursor ? parseInt(cursor, 10) : 1;
      const data = (await rioFetch(
        apiKey,
        `/campaigns/${campaignId}/people?limit=${limit}&page=${page}`,
      )) as Array<{
        id: number;
        email: string;
        opens?: number;
        replies?: number;
        clicks?: number;
        lastOpenedAt?: string;
        lastRepliedAt?: string;
      }>;

      if (!Array.isArray(data)) return { items: [] };

      const items = data.map((l) => ({
        id: String(l.id),
        email: l.email,
        openCount: l.opens ?? 0,
        replyCount: l.replies ?? 0,
        clickCount: l.clicks ?? 0,
        interestStatus: null,
        lastOpenAt: l.lastOpenedAt ?? null,
        lastReplyAt: l.lastRepliedAt ?? null,
      }));

      return {
        items,
        nextCursor: items.length >= limit ? String(page + 1) : undefined,
      };
    },

    async addLeads(campaignId: string, leads: ESPLeadData[]): Promise<AddLeadsResult> {
      const people = leads.map((lead) => ({
        email: lead.email,
        firstName: lead.firstName ?? "",
        lastName: lead.lastName ?? "",
        company: lead.company ?? "",
        ...(lead.customVariables ?? {}),
      }));

      const result = (await rioFetch(apiKey, `/campaigns/${campaignId}/people`, "POST", {
        people,
      })) as { added?: number; duplicates?: number; errors?: string[] };

      return {
        added: result.added ?? leads.length,
        skipped: result.duplicates ?? 0,
        errors: result.errors?.length ? result.errors : undefined,
      };
    },

    async getEmails(params: GetEmailsParams): Promise<GetEmailsResult> {
      const queryParts: string[] = [];
      if (params.campaignId) queryParts.push(`campaignId=${params.campaignId}`);
      if (params.emailType === "sent") queryParts.push("type=sent");
      if (params.emailType === "received") queryParts.push("type=received");
      if (params.limit) queryParts.push(`limit=${params.limit}`);

      const query = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";

      const data = (await rioFetch(apiKey, `/activities${query}`)) as Array<{
        id: number;
        type?: string;
        from?: string;
        to?: string;
        subject?: string;
        preview?: string;
        createdAt?: string;
        isAutoReply?: boolean;
      }>;

      if (!Array.isArray(data)) return { items: [], hasMore: false };

      const items = data.map((a) => ({
        id: String(a.id),
        from: a.from ?? undefined,
        to: a.to ?? undefined,
        subject: a.subject ?? undefined,
        preview: a.preview ?? undefined,
        timestamp: a.createdAt ?? undefined,
        isAutoReply: a.isAutoReply ?? false,
      }));

      return {
        items,
        hasMore: items.length >= (params.limit ?? 50),
      };
    },

    async replyToEmail(params: ReplyToEmailParams): Promise<ReplyToEmailResult> {
      try {
        const result = (await rioFetch(apiKey, "/activities/reply", "POST", {
          emailId: params.emailId,
          campaignId: params.campaignId,
          body: params.body,
        })) as { id?: string };
        return { id: result.id ?? undefined };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },

    async removeFromSequence(params: RemoveFromSequenceParams): Promise<RemoveFromSequenceResult> {
      try {
        // Reply.io requires person ID, but we only have email — find person first
        const people = (await rioFetch(
          apiKey,
          `/campaigns/${params.campaignId}/people?email=${encodeURIComponent(params.leadEmail)}&limit=1`,
        )) as Array<{ id: number }>;

        if (!Array.isArray(people) || people.length === 0) {
          return { removed: false, error: "Person not found in campaign" };
        }

        await rioFetch(
          apiKey,
          `/campaigns/${params.campaignId}/people/${people[0].id}`,
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
