/**
 * Smartlead ESP Provider — implements ESPProvider via Smartlead API.
 *
 * API docs: https://api.smartlead.ai/reference
 * Auth: api_key as query parameter on every request.
 *
 * Key endpoints:
 * - GET  /api/v1/email-accounts?api_key=X          — list email accounts
 * - POST /api/v1/campaigns/create?api_key=X         — create campaign
 * - POST /api/v1/campaigns/{id}/settings?api_key=X  — update campaign settings (schedule, etc.)
 * - POST /api/v1/campaigns/{id}/sequences?api_key=X — add email sequences (steps)
 * - POST /api/v1/campaigns/{id}/leads?api_key=X     — add leads
 * - POST /api/v1/campaigns/{id}/status?api_key=X    — start/pause campaign
 * - GET  /api/v1/campaigns/{id}/analytics?api_key=X — get analytics
 * - GET  /api/v1/campaigns/{id}/leads?api_key=X     — get leads (with email activity)
 */

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

const SMARTLEAD_BASE = "https://server.smartlead.ai/api/v1";

// ─── API Helpers ────────────────────────────────────────

async function slFetch(
  apiKey: string,
  path: string,
  method: "GET" | "POST" | "PATCH" = "GET",
  body?: Record<string, unknown>,
): Promise<unknown> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${SMARTLEAD_BASE}${path}${sep}api_key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Smartlead ${method} ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

// ─── Connection Test ────────────────────────────────────

export async function testSmartleadConnection(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${SMARTLEAD_BASE}/email-accounts?api_key=${encodeURIComponent(apiKey)}`,
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ─── ESP Provider Implementation ────────────────────────

export function createSmartleadESP(apiKey: string): ESPProvider {
  return {
    name: "smartlead",

    async listAccounts(): Promise<ESPAccount[]> {
      const data = (await slFetch(apiKey, "/email-accounts")) as Array<{
        id: number;
        from_email: string;
        from_name?: string;
        is_active?: boolean;
        max_email_per_day?: number;
      }>;

      return data.map((a) => ({
        email: a.from_email,
        name: a.from_name ?? undefined,
        status: a.is_active !== false ? "active" : "inactive",
        dailySendLimit: a.max_email_per_day ?? undefined,
      }));
    },

    async createCampaign(params: CreateCampaignParams): Promise<ESPCampaign> {
      // Step 1: Create the campaign shell
      const campaign = (await slFetch(apiKey, "/campaigns/create", "POST", {
        name: params.name,
      })) as { id: number; name: string };

      const campaignId = String(campaign.id);

      // Step 2: Add sequences (email steps)
      const sequences = params.steps.map((step, idx) => ({
        seq_number: idx + 1,
        seq_delay_details: {
          delay_in_days: idx === 0 ? 0 : step.delay,
        },
        subject: step.subject,
        email_body: step.body,
      }));

      await slFetch(apiKey, `/campaigns/${campaignId}/sequences`, "POST", {
        sequences,
      });

      // Step 3: Set schedule and email accounts
      if (params.accountEmails.length > 0) {
        // Smartlead uses account IDs, but we try to map from emails
        // First, get all accounts to find IDs matching the requested emails
        const accounts = (await slFetch(apiKey, "/email-accounts")) as Array<{
          id: number;
          from_email: string;
        }>;
        const emailToId = new Map(accounts.map((a) => [a.from_email.toLowerCase(), a.id]));
        const accountIds = params.accountEmails
          .map((e) => emailToId.get(e.toLowerCase()))
          .filter((id): id is number => id !== undefined);

        if (accountIds.length > 0) {
          await slFetch(apiKey, `/campaigns/${campaignId}/settings`, "POST", {
            email_account_ids: accountIds,
            ...(params.timezone ? { timezone: params.timezone } : {}),
            ...(params.dailyLimit ? { max_leads_per_day: params.dailyLimit } : {}),
          });
        }
      }

      return { id: campaignId, name: params.name, status: "DRAFTED" };
    },

    async activateCampaign(campaignId: string): Promise<void> {
      await slFetch(apiKey, `/campaigns/${campaignId}/status`, "POST", {
        status: "START",
      });
    },

    async pauseCampaign(campaignId: string): Promise<void> {
      await slFetch(apiKey, `/campaigns/${campaignId}/status`, "POST", {
        status: "PAUSE",
      });
    },

    async getCampaignStatus(campaignId: string): Promise<CampaignSendingStatus> {
      const data = (await slFetch(apiKey, `/campaigns/${campaignId}/analytics`)) as {
        sent_count?: number;
        open_count?: number;
        reply_count?: number;
        bounce_count?: number;
        campaign_status?: string;
      };

      return {
        campaignId,
        status: data.campaign_status ?? "unknown",
        sent: data.sent_count ?? 0,
        opened: data.open_count ?? 0,
        replied: data.reply_count ?? 0,
        bounced: data.bounce_count ?? 0,
        raw: data,
      };
    },

    async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
      const data = (await slFetch(apiKey, `/campaigns/${campaignId}/analytics`)) as {
        sent_count?: number;
        open_count?: number;
        click_count?: number;
        reply_count?: number;
        bounce_count?: number;
        unsubscribe_count?: number;
      };

      const sent = data.sent_count ?? 0;

      return {
        campaignId,
        sent,
        opened: data.open_count ?? 0,
        openRate: sent > 0 ? (data.open_count ?? 0) / sent : undefined,
        replied: data.reply_count ?? 0,
        replyRate: sent > 0 ? (data.reply_count ?? 0) / sent : undefined,
        bounced: data.bounce_count ?? 0,
        clicked: data.click_count ?? 0,
        unsubscribed: data.unsubscribe_count ?? 0,
        raw: data,
      };
    },

    async getStepAnalytics(campaignId: string): Promise<StepAnalytics[]> {
      // Smartlead: per-step analytics via campaign sequences endpoint
      const data = (await slFetch(apiKey, `/campaigns/${campaignId}/sequences`)) as Array<{
        seq_number?: number;
        sent_count?: number;
        open_count?: number;
        reply_count?: number;
        bounce_count?: number;
      }>;

      if (!Array.isArray(data)) return [];

      return data.map((s) => ({
        step: (s.seq_number ?? 1) - 1, // 1-indexed → 0-indexed
        sent: s.sent_count ?? 0,
        opened: s.open_count ?? 0,
        replied: s.reply_count ?? 0,
        bounced: s.bounce_count ?? 0,
      }));
    },

    async getLeadsPerformance(campaignId: string, limit: number, cursor?: string): Promise<LeadPerformancePage> {
      const offset = cursor ? parseInt(cursor, 10) : 0;
      const data = (await slFetch(
        apiKey,
        `/campaigns/${campaignId}/leads?limit=${limit}&offset=${offset}`,
      )) as Array<{
        id: number;
        email: string;
        lead_status?: string;
        open_count?: number;
        reply_count?: number;
        click_count?: number;
        last_open_time?: string;
        last_reply_time?: string;
      }>;

      if (!Array.isArray(data)) return { items: [] };

      const items = data.map((l) => ({
        id: String(l.id),
        email: l.email,
        openCount: l.open_count ?? 0,
        replyCount: l.reply_count ?? 0,
        clickCount: l.click_count ?? 0,
        interestStatus: null,
        lastOpenAt: l.last_open_time ?? null,
        lastReplyAt: l.last_reply_time ?? null,
      }));

      return {
        items,
        nextCursor: items.length >= limit ? String(offset + limit) : undefined,
      };
    },

    async addLeads(campaignId: string, leads: ESPLeadData[]): Promise<AddLeadsResult> {
      // Smartlead accepts batch lead upload
      const leadList = leads.map((lead) => ({
        email: lead.email,
        first_name: lead.firstName ?? "",
        last_name: lead.lastName ?? "",
        company: lead.company ?? "",
        ...(lead.customVariables ?? {}),
      }));

      const result = (await slFetch(apiKey, `/campaigns/${campaignId}/leads`, "POST", {
        lead_list: leadList,
      })) as { upload_count?: number; already_exist?: number };

      return {
        added: result.upload_count ?? leads.length,
        skipped: result.already_exist ?? 0,
      };
    },

    async getEmails(params: GetEmailsParams): Promise<GetEmailsResult> {
      // Smartlead exposes email activity through campaign leads endpoint
      if (!params.campaignId) {
        return { items: [], hasMore: false };
      }

      const data = (await slFetch(
        apiKey,
        `/campaigns/${params.campaignId}/leads?limit=${params.limit ?? 50}`,
      )) as Array<{
        id: number;
        email: string;
        lead_status?: string;
        email_activities?: Array<{
          id: number;
          type?: string;
          subject?: string;
          body_preview?: string;
          sent_time?: string;
          is_auto_reply?: boolean;
        }>;
      }>;

      // Flatten lead activities into ESPEmail[]
      const items = data.flatMap((lead) =>
        (lead.email_activities ?? []).map((activity) => ({
          id: String(activity.id),
          from: undefined,
          to: lead.email,
          subject: activity.subject ?? undefined,
          preview: activity.body_preview ?? undefined,
          timestamp: activity.sent_time ?? undefined,
          isAutoReply: activity.is_auto_reply ?? false,
        })),
      );

      return {
        items: items.slice(0, params.limit ?? 50),
        hasMore: items.length > (params.limit ?? 50),
      };
    },

    async replyToEmail(params: ReplyToEmailParams): Promise<ReplyToEmailResult> {
      try {
        const result = await slFetch(
          apiKey,
          `/campaigns/${params.campaignId}/reply-email-thread`,
          "POST",
          { email_message_id: params.emailId, body: params.body },
        );
        const data = result as { id?: string };
        return { id: data.id ?? undefined };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },

    async removeFromSequence(params: RemoveFromSequenceParams): Promise<RemoveFromSequenceResult> {
      try {
        // Smartlead: update lead status/category to stop sequence
        const statusMap: Record<string, string> = {
          interested: "INTERESTED",
          not_interested: "NOT_INTERESTED",
          meeting_booked: "MEETING_BOOKED",
        };
        await slFetch(
          apiKey,
          `/campaigns/${params.campaignId}/leads/${encodeURIComponent(params.leadEmail)}/status`,
          "POST",
          { status: statusMap[params.reason] },
        );
        return { removed: true };
      } catch (err) {
        return { removed: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
