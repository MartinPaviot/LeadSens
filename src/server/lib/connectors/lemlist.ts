/**
 * Lemlist ESP Provider — implements ESPProvider via Lemlist API.
 *
 * API docs: https://developer.lemlist.com/
 * Auth: Basic auth with API key as password (empty username).
 * Header: Authorization: Basic base64(":apiKey")
 *
 * Key endpoints:
 * - GET  /api/team                         — test connection
 * - GET  /api/senders                      — list sender accounts
 * - POST /api/campaigns                    — create campaign
 * - POST /api/campaigns/{id}/leads/{email} — add lead to campaign
 * - PUT  /api/campaigns/{id}/start         — start campaign
 * - PUT  /api/campaigns/{id}/pause         — pause campaign
 * - GET  /api/campaigns/{id}               — get campaign details + stats
 * - GET  /api/activities                   — get all activities
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

const LEMLIST_BASE = "https://api.lemlist.com/api";

// ─── API Helpers ────────────────────────────────────────

function authHeader(apiKey: string): string {
  // Lemlist uses Basic auth: base64(":apiKey")
  const encoded = Buffer.from(`:${apiKey}`).toString("base64");
  return `Basic ${encoded}`;
}

async function lemFetch(
  apiKey: string,
  path: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  body?: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${LEMLIST_BASE}${path}`, {
    method,
    headers: {
      Authorization: authHeader(apiKey),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Lemlist ${method} ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }

  // Some Lemlist endpoints return empty responses
  const contentType = res.headers.get("content-type");
  if (!contentType?.includes("application/json")) return {};
  return res.json();
}

// ─── Connection Test ────────────────────────────────────

export async function testLemlistConnection(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${LEMLIST_BASE}/team`, {
      headers: { Authorization: authHeader(apiKey) },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── ESP Provider Implementation ────────────────────────

export function createLemlistESP(apiKey: string): ESPProvider {
  return {
    name: "lemlist",

    async listAccounts(): Promise<ESPAccount[]> {
      // Lemlist uses "senders" as email accounts
      const data = (await lemFetch(apiKey, "/senders")) as Array<{
        _id: string;
        email: string;
        name?: string;
        isPaused?: boolean;
        dailyLimit?: number;
      }>;

      if (!Array.isArray(data)) return [];

      return data.map((s) => ({
        email: s.email,
        name: s.name ?? undefined,
        status: s.isPaused ? "paused" : "active",
        dailySendLimit: s.dailyLimit ?? undefined,
      }));
    },

    async createCampaign(params: CreateCampaignParams): Promise<ESPCampaign> {
      // Step 1: Create the campaign
      const campaign = (await lemFetch(apiKey, "/campaigns", "POST", {
        name: params.name,
      })) as { _id: string; name: string };

      const campaignId = campaign._id;

      // Step 2: Add sequences (email steps)
      // Lemlist adds sequences one at a time
      for (let i = 0; i < params.steps.length; i++) {
        const step = params.steps[i];
        await lemFetch(apiKey, `/campaigns/${campaignId}/sequences`, "POST", {
          type: "email",
          subject: step.subject,
          html: step.body,
          delay: i === 0 ? 0 : step.delay,
          delayUnit: "days",
        });
      }

      // Step 3: Set sender accounts
      // Lemlist requires adding senders to campaign
      if (params.accountEmails.length > 0) {
        // Get all senders to map emails → IDs
        const senders = (await lemFetch(apiKey, "/senders")) as Array<{
          _id: string;
          email: string;
        }>;
        const emailToId = new Map(
          (Array.isArray(senders) ? senders : []).map((s) => [s.email.toLowerCase(), s._id]),
        );

        for (const email of params.accountEmails) {
          const senderId = emailToId.get(email.toLowerCase());
          if (senderId) {
            await lemFetch(apiKey, `/campaigns/${campaignId}/senders/${senderId}`, "POST");
          }
        }
      }

      return { id: campaignId, name: params.name, status: "draft" };
    },

    async activateCampaign(campaignId: string): Promise<void> {
      await lemFetch(apiKey, `/campaigns/${campaignId}/start`, "PUT");
    },

    async pauseCampaign(campaignId: string): Promise<void> {
      await lemFetch(apiKey, `/campaigns/${campaignId}/pause`, "PUT");
    },

    async getCampaignStatus(campaignId: string): Promise<CampaignSendingStatus> {
      const data = (await lemFetch(apiKey, `/campaigns/${campaignId}`)) as {
        _id: string;
        name: string;
        status?: string;
        stats?: {
          sent?: number;
          opened?: number;
          replied?: number;
          bounced?: number;
        };
      };

      return {
        campaignId,
        status: data.status ?? "unknown",
        sent: data.stats?.sent ?? 0,
        opened: data.stats?.opened ?? 0,
        replied: data.stats?.replied ?? 0,
        bounced: data.stats?.bounced ?? 0,
        raw: data,
      };
    },

    async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
      const data = (await lemFetch(apiKey, `/campaigns/${campaignId}`)) as {
        stats?: {
          sent?: number;
          opened?: number;
          clicked?: number;
          replied?: number;
          bounced?: number;
          unsubscribed?: number;
        };
      };

      const stats = data.stats ?? {};
      const sent = stats.sent ?? 0;

      return {
        campaignId,
        sent,
        opened: stats.opened ?? 0,
        openRate: sent > 0 ? (stats.opened ?? 0) / sent : undefined,
        replied: stats.replied ?? 0,
        replyRate: sent > 0 ? (stats.replied ?? 0) / sent : undefined,
        bounced: stats.bounced ?? 0,
        clicked: stats.clicked ?? 0,
        unsubscribed: stats.unsubscribed ?? 0,
        raw: data,
      };
    },

    async getStepAnalytics(campaignId: string): Promise<StepAnalytics[]> {
      // Lemlist exposes per-sequence stats within campaign details
      const data = (await lemFetch(apiKey, `/campaigns/${campaignId}`)) as {
        sequences?: Array<{
          stepNumber?: number;
          stats?: {
            sent?: number;
            opened?: number;
            replied?: number;
            bounced?: number;
          };
        }>;
      };

      if (!data.sequences || !Array.isArray(data.sequences)) return [];

      return data.sequences.map((seq) => ({
        step: (seq.stepNumber ?? 1) - 1, // 1-indexed → 0-indexed
        sent: seq.stats?.sent ?? 0,
        opened: seq.stats?.opened ?? 0,
        replied: seq.stats?.replied ?? 0,
        bounced: seq.stats?.bounced ?? 0,
      }));
    },

    async getLeadsPerformance(campaignId: string, limit: number, cursor?: string): Promise<LeadPerformancePage> {
      const offset = cursor ? parseInt(cursor, 10) : 0;
      const data = (await lemFetch(
        apiKey,
        `/campaigns/${campaignId}/leads?limit=${limit}&offset=${offset}`,
      )) as Array<{
        _id: string;
        email: string;
        openCount?: number;
        replyCount?: number;
        clickCount?: number;
        lastOpenedAt?: string;
        lastRepliedAt?: string;
      }>;

      if (!Array.isArray(data)) return { items: [] };

      const items = data.map((l) => ({
        id: l._id,
        email: l.email,
        openCount: l.openCount ?? 0,
        replyCount: l.replyCount ?? 0,
        clickCount: l.clickCount ?? 0,
        interestStatus: null,
        lastOpenAt: l.lastOpenedAt ?? null,
        lastReplyAt: l.lastRepliedAt ?? null,
      }));

      return {
        items,
        nextCursor: items.length >= limit ? String(offset + limit) : undefined,
      };
    },

    async addLeads(campaignId: string, leads: ESPLeadData[]): Promise<AddLeadsResult> {
      // Lemlist adds leads one at a time via POST /campaigns/{id}/leads/{email}
      let added = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const lead of leads) {
        try {
          await lemFetch(
            apiKey,
            `/campaigns/${campaignId}/leads/${encodeURIComponent(lead.email)}`,
            "POST",
            {
              firstName: lead.firstName ?? "",
              lastName: lead.lastName ?? "",
              companyName: lead.company ?? "",
              ...(lead.customVariables ?? {}),
            },
          );
          added++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("409") || msg.includes("already")) {
            skipped++;
          } else {
            errors.push(`${lead.email}: ${msg}`);
          }
        }
      }

      return {
        added,
        skipped: skipped > 0 ? skipped : undefined,
        errors: errors.length > 0 ? errors : undefined,
      };
    },

    async getEmails(params: GetEmailsParams): Promise<GetEmailsResult> {
      // Lemlist activities endpoint
      const queryParts: string[] = [];
      if (params.campaignId) queryParts.push(`campaignId=${params.campaignId}`);
      if (params.emailType === "sent") queryParts.push("type=emailsSent");
      if (params.emailType === "received") queryParts.push("type=emailsReplied");
      if (params.limit) queryParts.push(`limit=${params.limit}`);

      const query = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";

      const data = (await lemFetch(apiKey, `/activities${query}`)) as Array<{
        _id: string;
        type?: string;
        leadEmail?: string;
        senderEmail?: string;
        subject?: string;
        snippet?: string;
        createdAt?: string;
        isAutoReply?: boolean;
      }>;

      if (!Array.isArray(data)) return { items: [], hasMore: false };

      const items = data.map((a) => ({
        id: a._id,
        from: a.senderEmail ?? undefined,
        to: a.leadEmail ?? undefined,
        subject: a.subject ?? undefined,
        preview: a.snippet ?? undefined,
        timestamp: a.createdAt ?? undefined,
        isAutoReply: a.isAutoReply ?? false,
      }));

      return {
        items,
        hasMore: items.length >= (params.limit ?? 50),
      };
    },

    async replyToEmail(_params: ReplyToEmailParams): Promise<ReplyToEmailResult> {
      return { error: "Reply via API is not supported by Lemlist. Please reply directly from the Lemlist UI." };
    },

    async removeFromSequence(params: RemoveFromSequenceParams): Promise<RemoveFromSequenceResult> {
      try {
        await lemFetch(
          apiKey,
          `/campaigns/${params.campaignId}/leads/${encodeURIComponent(params.leadEmail)}`,
          "DELETE",
        );
        return { removed: true };
      } catch (err) {
        return { removed: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
