/**
 * Salesloft ESP Provider — implements ESPProvider via Salesloft API v2.
 *
 * API docs: https://developers.salesloft.com/docs/api
 * Auth: `Authorization: Bearer API_KEY` header
 * Rate limit: 600 cost/minute — respect 429 responses with exponential backoff
 *
 * Key endpoints:
 * - GET  /v2/me.json                    — validate connection
 * - GET  /v2/cadences.json              — list cadences
 * - GET  /v2/cadence_stats/{id}.json    — cadence analytics
 * - POST /v2/people.json                — create person
 * - POST /v2/cadence_memberships.json   — add person to cadence
 * - GET  /v2/people.json                — list people
 *
 * Response envelope: { data: {...}, metadata: { paging: {...} } }
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

const SL_BASE = "https://api.salesloft.com/v2";
const MAX_RETRIES = 3;

// ─── API Helpers ────────────────────────────────────────

async function slFetch(
  apiKey: string,
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: Record<string, unknown>,
): Promise<unknown> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${SL_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
    throw new Error(`Salesloft ${method} ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }

  throw new Error(`Salesloft ${method} ${path} failed after ${MAX_RETRIES} retries`);
}

// ─── Connection Test ────────────────────────────────────

export async function testSalesloftConnection(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${SL_BASE}/me.json`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── ESP Provider Implementation ────────────────────────

export function createSalesloftESP(apiKey: string): ESPProvider {
  return {
    name: "salesloft",

    async listAccounts(): Promise<ESPAccount[]> {
      // Salesloft does not have a concept of sending accounts — sending is
      // handled internally by Salesloft's email infrastructure. Return empty.
      return [];
    },

    async createCampaign(_params: CreateCampaignParams): Promise<ESPCampaign> {
      throw new Error(
        "Salesloft cadences must be created in the Salesloft UI. " +
          "Use addLeads() to enroll people into an existing cadence.",
      );
    },

    async activateCampaign(_campaignId: string): Promise<void> {
      // Salesloft cadences don't have a simple activate toggle via API.
      // Cadences are active once people are enrolled.
    },

    async pauseCampaign(_campaignId: string): Promise<void> {
      // Salesloft cadences don't have a simple pause toggle via API.
      // Manage cadence state from the Salesloft UI.
    },

    async getCampaignStatus(campaignId: string): Promise<CampaignSendingStatus> {
      const data = (await slFetch(apiKey, `/cadence_stats/${campaignId}.json`)) as {
        data?: {
          sent?: number;
          opened?: number;
          replied?: number;
          bounced?: number;
        };
      };

      const stats = data.data ?? {};

      return {
        campaignId,
        status: "active",
        sent: stats.sent ?? 0,
        opened: stats.opened ?? 0,
        replied: stats.replied ?? 0,
        bounced: stats.bounced ?? 0,
        raw: data,
      };
    },

    async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
      const data = (await slFetch(apiKey, `/cadence_stats/${campaignId}.json`)) as {
        data?: {
          sent?: number;
          opened?: number;
          clicked?: number;
          replied?: number;
          bounced?: number;
        };
      };

      const stats = data.data ?? {};
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
        raw: data,
      };
    },

    async getStepAnalytics(_campaignId: string): Promise<StepAnalytics[]> {
      // Salesloft cadence_stats endpoint returns aggregate stats only,
      // not per-step breakdowns. Return empty.
      return [];
    },

    async getLeadsPerformance(campaignId: string, limit: number, cursor?: string): Promise<LeadPerformancePage> {
      const page = cursor ? parseInt(cursor, 10) : 1;
      const data = (await slFetch(
        apiKey,
        `/people.json?cadence_id=${campaignId}&per_page=${limit}&page=${page}`,
      )) as {
        data?: Array<{
          id: number;
          email_address?: string;
          counts?: {
            emails_sent?: number;
            emails_viewed?: number;
            emails_replied_to?: number;
            emails_clicked?: number;
          };
        }>;
        metadata?: { paging?: { total_pages?: number } };
      };

      const people = data.data ?? [];

      const items = people.map((p) => ({
        id: String(p.id),
        email: p.email_address ?? "",
        openCount: p.counts?.emails_viewed ?? 0,
        replyCount: p.counts?.emails_replied_to ?? 0,
        clickCount: p.counts?.emails_clicked ?? 0,
        interestStatus: null,
        lastOpenAt: null,
        lastReplyAt: null,
      }));

      const totalPages = data.metadata?.paging?.total_pages ?? 1;

      return {
        items,
        nextCursor: page < totalPages ? String(page + 1) : undefined,
      };
    },

    async addLeads(campaignId: string, leads: ESPLeadData[]): Promise<AddLeadsResult> {
      let added = 0;
      const errors: string[] = [];

      for (const lead of leads) {
        try {
          // Step 1: Create the person in Salesloft
          const personResult = (await slFetch(apiKey, "/people.json", "POST", {
            email_address: lead.email,
            first_name: lead.firstName ?? "",
            last_name: lead.lastName ?? "",
            company_name: lead.company ?? "",
            ...(lead.customVariables ?? {}),
          })) as { data?: { id: number } };

          const personId = personResult.data?.id;
          if (!personId) {
            errors.push(`Failed to create person for ${lead.email}: no ID returned`);
            continue;
          }

          // Step 2: Add person to the cadence
          await slFetch(apiKey, "/cadence_memberships.json", "POST", {
            person_id: personId,
            cadence_id: parseInt(campaignId, 10),
          });

          added++;
        } catch (err) {
          errors.push(
            `Failed to add ${lead.email}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      return {
        added,
        skipped: leads.length - added - errors.length,
        errors: errors.length > 0 ? errors : undefined,
      };
    },

    async getEmails(params: GetEmailsParams): Promise<GetEmailsResult> {
      if (!params.campaignId) {
        return { items: [], hasMore: false };
      }

      const limit = params.limit ?? 50;
      const data = (await slFetch(
        apiKey,
        `/activities/emails.json?cadence_id=${params.campaignId}&per_page=${limit}`,
      )) as {
        data?: Array<{
          id: number;
          to?: string;
          subject?: string;
          body_preview?: string;
          created_at?: string;
        }>;
        metadata?: { paging?: { total_pages?: number; current_page?: number } };
      };

      const emails = data.data ?? [];

      const items = emails.map((e) => ({
        id: String(e.id),
        from: undefined,
        to: e.to ?? undefined,
        subject: e.subject ?? undefined,
        preview: e.body_preview ?? undefined,
        timestamp: e.created_at ?? undefined,
        isAutoReply: false,
      }));

      const paging = data.metadata?.paging;
      const hasMore = (paging?.current_page ?? 1) < (paging?.total_pages ?? 1);

      return { items, hasMore };
    },

    async replyToEmail(_params: ReplyToEmailParams): Promise<ReplyToEmailResult> {
      return { error: "Reply via API is not supported by Salesloft. Please reply from the Salesloft UI." };
    },

    async removeFromSequence(params: RemoveFromSequenceParams): Promise<RemoveFromSequenceResult> {
      try {
        // Find the person by email
        const searchResult = (await slFetch(
          apiKey,
          `/people.json?email_addresses[]=${encodeURIComponent(params.leadEmail)}`,
        )) as { data?: Array<{ id: number }> };

        const person = searchResult.data?.[0];
        if (!person) {
          return { removed: false, error: `Person not found: ${params.leadEmail}` };
        }

        // Find and delete cadence membership
        const memberships = (await slFetch(
          apiKey,
          `/cadence_memberships.json?person_id=${person.id}&cadence_id=${params.campaignId}`,
        )) as { data?: Array<{ id: number }> };

        const membership = memberships.data?.[0];
        if (!membership) {
          return { removed: false, error: `No cadence membership found for ${params.leadEmail}` };
        }

        await slFetch(apiKey, `/cadence_memberships/${membership.id}.json`, "DELETE");
        return { removed: true };
      } catch (err) {
        return { removed: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async disableVariant(_campaignId: string, _stepIndex: number, _variantIndex: number): Promise<boolean> {
      // Salesloft does not support A/B variant management via API.
      return false;
    },
  };
}
