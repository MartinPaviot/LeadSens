/**
 * GMass ESP Provider — implements ESPProvider via GMass API.
 *
 * API docs: https://www.gmass.co/api/
 * Auth: `X-apikey: API_KEY` header
 *
 * Key endpoints:
 * - GET  /api/user                              — validate connection
 * - GET  /api/campaigns?limit=100               — list campaigns with stats
 * - GET  /api/campaigns/{campaignId}            — campaign details + statistics
 * - POST /api/campaigndrafts                    — create campaign draft
 * - POST /api/campaigns/{campaignDraftId}       — send campaign from draft
 * - GET  /api/reports/{campaignId}/opens        — open reports
 * - GET  /api/reports/{campaignId}/clicks       — click reports
 * - GET  /api/reports/{campaignId}/replies      — reply reports
 * - GET  /api/reports/{campaignId}/bounces      — bounce reports
 *
 * Note: GMass sends via Gmail — it is not standalone SMTP.
 * Campaign creation is a two-step process: create draft → send campaign.
 * Response envelope: { metadata: { totalRecords, offset, limit }, data: [...] }
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

const GMASS_BASE = "https://api.gmass.co/api";
const MAX_RETRIES = 3;

// ─── API Helpers ────────────────────────────────────────

async function gmassFetch(
  apiKey: string,
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: Record<string, unknown>,
): Promise<unknown> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${GMASS_BASE}${path}`, {
      method,
      headers: {
        "X-apikey": apiKey,
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
    throw new Error(`GMass ${method} ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }

  throw new Error(`GMass ${method} ${path} failed after ${MAX_RETRIES} retries`);
}

// ─── Connection Test ────────────────────────────────────

export async function testGmassConnection(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${GMASS_BASE}/user`, {
      headers: { "X-apikey": apiKey },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Helpers ────────────────────────────────────────────

function notImplemented(method: string): never {
  throw new Error(`GMass does not support ${method}. GMass sends via Gmail and has no equivalent endpoint.`);
}

// ─── ESP Provider Implementation ────────────────────────

export function createGmassESP(apiKey: string): ESPProvider {
  return {
    name: "gmass",

    async listAccounts(): Promise<ESPAccount[]> {
      // GMass sends through the user's Gmail — there is no mail accounts endpoint.
      // Return the authenticated user as the single "account".
      try {
        const data = (await gmassFetch(apiKey, "/user")) as {
          email?: string;
          name?: string;
        };
        if (data.email) {
          return [{ email: data.email, name: data.name ?? undefined, status: "active" }];
        }
        return [];
      } catch {
        return [];
      }
    },

    async createCampaign(params: CreateCampaignParams): Promise<ESPCampaign> {
      // Step 1: Build email body from all steps.
      // GMass campaigns are single-message sends (no multi-step sequences in one campaign).
      // We use the first step as the primary email content.
      const firstStep = params.steps[0];
      if (!firstStep) {
        throw new Error("GMass createCampaign requires at least one step");
      }

      // Step 1: Create a campaign draft
      const draft = (await gmassFetch(apiKey, "/campaigndrafts", "POST", {
        subject: firstStep.subject,
        message: firstStep.body,
        campaignName: params.name,
      })) as { campaignDraftId?: string };

      if (!draft.campaignDraftId) {
        throw new Error("GMass createCampaign: failed to create draft — no campaignDraftId returned");
      }

      // Step 2: Send the campaign from the draft
      const campaign = (await gmassFetch(apiKey, `/campaigns/${draft.campaignDraftId}`, "POST", {
        ...(params.timezone ? { timezone: params.timezone } : {}),
      })) as { campaignId?: string; id?: string; name?: string };

      const campaignId = campaign.campaignId ?? campaign.id ?? draft.campaignDraftId;

      return {
        id: String(campaignId),
        name: params.name,
        status: "sent",
      };
    },

    async activateCampaign(_campaignId: string): Promise<void> {
      // GMass campaigns are sent immediately from drafts — no activate/pause lifecycle.
      // This is a no-op for compatibility.
    },

    async pauseCampaign(_campaignId: string): Promise<void> {
      // GMass campaigns are sent immediately — no pause capability via API.
      // This is a no-op for compatibility.
    },

    async getCampaignStatus(campaignId: string): Promise<CampaignSendingStatus> {
      const data = (await gmassFetch(apiKey, `/campaigns/${campaignId}`)) as {
        status?: string;
        statistics?: {
          recipients?: number;
          opens?: number;
          replies?: number;
          bounces?: number;
        };
      };

      const stats = data.statistics;
      return {
        campaignId,
        status: data.status ?? "unknown",
        sent: stats?.recipients ?? 0,
        opened: stats?.opens ?? 0,
        replied: stats?.replies ?? 0,
        bounced: stats?.bounces ?? 0,
        raw: data,
      };
    },

    async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
      const data = (await gmassFetch(apiKey, `/campaigns/${campaignId}`)) as {
        statistics?: {
          recipients?: number;
          opens?: number;
          clicks?: number;
          replies?: number;
          bounces?: number;
          unsubscribes?: number;
          blocks?: number;
        };
      };

      const stats = data.statistics;
      const sent = stats?.recipients ?? 0;

      return {
        campaignId,
        sent,
        opened: stats?.opens ?? 0,
        openRate: sent > 0 ? (stats?.opens ?? 0) / sent : undefined,
        replied: stats?.replies ?? 0,
        replyRate: sent > 0 ? (stats?.replies ?? 0) / sent : undefined,
        bounced: stats?.bounces ?? 0,
        clicked: stats?.clicks ?? 0,
        unsubscribed: stats?.unsubscribes ?? 0,
        raw: data.statistics,
      };
    },

    async getStepAnalytics(_campaignId: string): Promise<StepAnalytics[]> {
      // GMass campaigns are single-step (one email per campaign) — no per-step breakdown.
      // Return the campaign-level stats as step 0 for compatibility.
      const analytics = await this.getCampaignAnalytics(_campaignId);
      return [
        {
          step: 0,
          sent: analytics.sent ?? 0,
          opened: analytics.opened ?? 0,
          replied: analytics.replied ?? 0,
          bounced: analytics.bounced ?? 0,
        },
      ];
    },

    async getLeadsPerformance(campaignId: string, limit: number, cursor?: string): Promise<LeadPerformancePage> {
      // Use the reports endpoints to build lead-level performance data
      const offset = cursor ? parseInt(cursor, 10) : 0;

      const data = (await gmassFetch(
        apiKey,
        `/reports/${campaignId}/opens?limit=${limit}&offset=${offset}`,
      )) as {
        metadata?: { totalRecords?: number };
        data?: Array<{
          emailAddress?: string;
          openCount?: number;
          lastOpenedAt?: string;
        }>;
      };

      const records = Array.isArray(data.data) ? data.data : [];
      const totalRecords = data.metadata?.totalRecords ?? 0;

      const items = records.map((r, i) => ({
        id: String(offset + i),
        email: r.emailAddress ?? "",
        openCount: r.openCount ?? 0,
        replyCount: 0,
        clickCount: 0,
        interestStatus: null,
        lastOpenAt: r.lastOpenedAt ?? null,
        lastReplyAt: null,
      }));

      const nextOffset = offset + items.length;
      return {
        items,
        nextCursor: nextOffset < totalRecords ? String(nextOffset) : undefined,
      };
    },

    async addLeads(campaignId: string, leads: ESPLeadData[]): Promise<AddLeadsResult> {
      // GMass has no "add leads to existing campaign" API.
      // Create a new draft with the email addresses and send it, linked to the original campaign name.
      const emailAddresses = leads.map((l) => l.email).join(",");

      try {
        // Create a draft targeting these leads
        const draft = (await gmassFetch(apiKey, "/campaigndrafts", "POST", {
          emailAddresses,
          subject: `Follow-up (campaign ${campaignId})`,
          message: "",
        })) as { campaignDraftId?: string };

        if (!draft.campaignDraftId) {
          return { added: 0, errors: ["Failed to create draft — no campaignDraftId returned"] };
        }

        // Send the draft
        await gmassFetch(apiKey, `/campaigns/${draft.campaignDraftId}`, "POST", {});

        return { added: leads.length, skipped: 0 };
      } catch (err) {
        return {
          added: 0,
          errors: [err instanceof Error ? err.message : String(err)],
        };
      }
    },

    async getEmails(params: GetEmailsParams): Promise<GetEmailsResult> {
      if (!params.campaignId) {
        return { items: [], hasMore: false };
      }

      // Use the replies report to get sent/received emails
      const limit = params.limit ?? 50;
      const data = (await gmassFetch(
        apiKey,
        `/reports/${params.campaignId}/replies?limit=${limit}`,
      )) as {
        metadata?: { totalRecords?: number };
        data?: Array<{
          id?: string;
          emailAddress?: string;
          subject?: string;
          preview?: string;
          repliedAt?: string;
        }>;
      };

      const records = Array.isArray(data.data) ? data.data : [];
      const totalRecords = data.metadata?.totalRecords ?? 0;

      const items = records.map((r) => ({
        id: r.id ?? r.emailAddress ?? "",
        from: undefined,
        to: r.emailAddress ?? undefined,
        subject: r.subject ?? undefined,
        preview: r.preview ?? undefined,
        timestamp: r.repliedAt ?? undefined,
        isAutoReply: false,
      }));

      return {
        items,
        hasMore: totalRecords > limit,
      };
    },

    async replyToEmail(_params: ReplyToEmailParams): Promise<ReplyToEmailResult> {
      return { error: "Reply via API is not supported by GMass. Replies are handled through Gmail directly." };
    },

    async removeFromSequence(_params: RemoveFromSequenceParams): Promise<RemoveFromSequenceResult> {
      // GMass does not have a sequence removal API — campaigns are single-send.
      return { removed: false, error: "GMass does not support sequence removal. Campaigns are single-send via Gmail." };
    },

    async disableVariant(_campaignId: string, _stepIndex: number, _variantIndex: number): Promise<boolean> {
      // GMass does not expose variant management via API.
      return false;
    },
  };
}
