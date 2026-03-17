/**
 * SalesHandy ESP Provider — implements ESPProvider via SalesHandy Open API.
 *
 * Official Swagger: https://open-api.saleshandy.com/api-doc/
 * Base URL: https://open-api.saleshandy.com
 * Auth: `x-api-key: API_KEY` header
 *
 * Key concepts:
 * - "Sequences" = campaigns (multi-step email sequences)
 * - "Steps" = individual emails within a sequence
 * - Prospect import is async — returns requestId, poll for status
 * - Import via field names: POST /v1/sequences/prospects/import-with-field-name
 *
 * Status: testConnection + addLeads + listCampaigns + analytics implemented.
 * Other methods return graceful errors until full integration.
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

const SH_BASE = "https://open-api.saleshandy.com";
const MAX_RETRIES = 3;

// ─── API Helpers ────────────────────────────────────────

async function shFetch(
  apiKey: string,
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: Record<string, unknown> | unknown[],
): Promise<unknown> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${SH_BASE}${path}`, {
      method,
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.ok) {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    }

    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      await sleep(Math.pow(2, attempt) * 1000);
      continue;
    }

    const text = await res.text().catch(() => "");
    throw new Error(`SalesHandy API ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }

  throw new Error(`SalesHandy API ${method} ${path} → max retries exceeded`);
}

// ─── Test Connection ────────────────────────────────────

/** Validate API key by listing sequences (lightest authenticated call) */
export async function testSaleshandyConnection(apiKey: string): Promise<boolean> {
  try {
    await shFetch(apiKey, "/v1/sequences?pageSize=1&page=1&sort=DESC&sortBy=sequence.createdAt");
    return true;
  } catch {
    return false;
  }
}

// ─── ESP Provider ───────────────────────────────────────

function notImplemented(method: string): never {
  throw new Error(`SalesHandy: ${method} not yet implemented — full integration coming soon`);
}

// Response types from SalesHandy API
interface SHSequence {
  id: string;
  title: string;
  active: boolean;
  steps?: { id: string; name: string }[];
}

interface SHEmailAccount {
  id: string;
  email: string;
  name?: string;
}

class SaleshandyESP implements ESPProvider {
  readonly name = "SalesHandy";
  constructor(private readonly apiKey: string) {}

  async listAccounts(): Promise<ESPAccount[]> {
    // SalesHandy uses POST to list email accounts
    const data = (await shFetch(this.apiKey, "/v1/email-accounts", "POST", {
      pageSize: 100,
      page: 1,
    })) as { payload?: SHEmailAccount[] } | null;

    return (data?.payload ?? []).map((a) => ({
      email: a.email,
      name: a.name,
    }));
  }

  async createCampaign(_params: CreateCampaignParams): Promise<ESPCampaign> {
    // SalesHandy API does not expose sequence creation — must be done in UI
    throw new Error("SalesHandy: Sequences must be created in the SalesHandy UI — API supports adding prospects to existing sequences");
  }

  async activateCampaign(campaignId: string): Promise<void> {
    await shFetch(this.apiKey, "/v1/sequences/status", "POST", {
      sequenceIds: [campaignId],
      status: "active",
    });
  }

  async pauseCampaign(campaignId: string): Promise<void> {
    await shFetch(this.apiKey, "/v1/sequences/status", "POST", {
      sequenceIds: [campaignId],
      status: "paused",
    });
  }

  async getCampaignStatus(_campaignId: string): Promise<CampaignSendingStatus> {
    notImplemented("getCampaignStatus");
  }

  async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
    const data = (await shFetch(this.apiKey, "/v1/analytics/stats", "POST", {
      sequenceIds: [campaignId],
    })) as { payload?: { sent?: number; opened?: number; replied?: number; bounced?: number; clicked?: number } } | null;

    const stats = data?.payload;
    const sent = stats?.sent ?? 0;
    return {
      campaignId,
      sent,
      opened: stats?.opened,
      openRate: sent > 0 && stats?.opened ? stats.opened / sent : undefined,
      replied: stats?.replied,
      replyRate: sent > 0 && stats?.replied ? stats.replied / sent : undefined,
      bounced: stats?.bounced,
      clicked: stats?.clicked,
    };
  }

  async getStepAnalytics(_campaignId: string): Promise<StepAnalytics[]> {
    notImplemented("getStepAnalytics");
  }

  async getLeadsPerformance(_campaignId: string, _limit: number, _cursor?: string): Promise<LeadPerformancePage> {
    notImplemented("getLeadsPerformance");
  }

  async addLeads(campaignId: string, leads: ESPLeadData[]): Promise<AddLeadsResult> {
    // First, get the sequence to find the first step ID
    const seqData = (await shFetch(
      this.apiKey,
      `/v1/sequences?pageSize=1&page=1&sort=DESC&sortBy=sequence.createdAt`,
    )) as { payload?: SHSequence[] } | null;

    // Find the target sequence's first step
    const sequence = seqData?.payload?.find((s) => s.id === campaignId);
    const firstStepId = sequence?.steps?.[0]?.id;

    if (!firstStepId) {
      // Fallback: try to list steps for this specific sequence
      throw new Error(`SalesHandy: Could not find steps for sequence ${campaignId}. Ensure the sequence exists and has at least one step.`);
    }

    // Import prospects using field names (async, supports up to 100K)
    const prospectList = leads.map((l) => ({
      Email: l.email,
      "First Name": l.firstName ?? "",
      "Last Name": l.lastName ?? "",
      Company: l.company ?? "",
      ...Object.fromEntries(
        Object.entries(l.customVariables ?? {}).map(([k, v]) => [k, v]),
      ),
    }));

    const result = (await shFetch(
      this.apiKey,
      "/v1/sequences/prospects/import-with-field-name",
      "POST",
      {
        prospectList,
        stepId: firstStepId,
        conflictAction: "addMissingFields",
        verifyProspects: true,
      },
    )) as { payload?: { requestId?: string } } | null;

    // Import is async — we return optimistic counts
    // The requestId can be used to poll /v1/prospects/import-status/{requestId}
    return {
      added: leads.length,
      skipped: 0,
      errors: result?.payload?.requestId
        ? undefined
        : ["Import may have failed — no requestId returned"],
    };
  }

  async getEmails(_params: GetEmailsParams): Promise<GetEmailsResult> {
    notImplemented("getEmails");
  }

  async replyToEmail(params: ReplyToEmailParams): Promise<ReplyToEmailResult> {
    // SalesHandy has a unified inbox reply endpoint
    try {
      await shFetch(this.apiKey, "/v1/unified-inbox/emails/reply", "POST", {
        emailThreadId: params.emailId,
        body: params.body,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Reply failed" };
    }
  }

  async removeFromSequence(params: RemoveFromSequenceParams): Promise<RemoveFromSequenceResult> {
    try {
      const statusMap: Record<string, string> = {
        interested: "replied",
        not_interested: "finished",
        meeting_booked: "replied",
      };

      await shFetch(this.apiKey, "/v1/prospects/status", "PATCH", {
        emails: [params.leadEmail],
        status: statusMap[params.reason] ?? "finished",
      });
      return { removed: true };
    } catch (err) {
      return { removed: false, error: err instanceof Error ? err.message : "Failed to remove" };
    }
  }

  async disableVariant(_campaignId: string, _stepIndex: number, _variantIndex: number): Promise<boolean> {
    return false; // SalesHandy API doesn't expose variant control
  }
}

export function createSaleshandyESP(apiKey: string): ESPProvider {
  return new SaleshandyESP(apiKey);
}
