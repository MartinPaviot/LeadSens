/**
 * QuickMail ESP Provider — implements ESPProvider via QuickMail API.
 *
 * Base URL: https://api.quickmail.io/v1/
 * Auth: `Authorization: <api_key>` header (plain key, NOT Bearer)
 *
 * IMPORTANT: QuickMail's API documentation is NOT publicly available.
 * The official docs page (blog.quickmail.io/api-v1-spec) is dead.
 * Only confirmed endpoints:
 * - GET /v1/accounts — validate API key (confirmed via Pipedream + live 401 test)
 * Other endpoints are inferred from Zapier actions but NOT confirmed:
 * - Prospects: create/update, cancel journey, unsubscribe
 *
 * Zapier triggers suggest these data types exist:
 * Bounces, Clicks, Opens, Replies, Tags, Unsubscribes, Journeys, Opportunities
 *
 * QuickMail domain concepts:
 * - Prospects = leads/contacts
 * - Buckets = groups of prospects (staging area)
 * - Campaigns = email sequences with Steps
 * - Journeys = a prospect's progression through Steps
 * - Schedules = automation rules pulling prospects from Buckets into Campaigns
 *
 * API key generation: Settings > Add-ons > Zapier section > "Generate Personal Zapier API key"
 * Requires Pro plan.
 *
 * Status: testConnection implemented. addLeads is best-effort (endpoint unconfirmed).
 * Full integration blocked until QuickMail publishes API docs.
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

const QM_BASE = "https://api.quickmail.io";
const MAX_RETRIES = 3;

// ─── API Helpers ────────────────────────────────────────

async function qmFetch(
  apiKey: string,
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: Record<string, unknown>,
): Promise<unknown> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${QM_BASE}${path}`, {
      method,
      headers: {
        // QuickMail uses plain API key, NOT Bearer
        Authorization: apiKey,
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
    throw new Error(`QuickMail API ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }

  throw new Error(`QuickMail API ${method} ${path} → max retries exceeded`);
}

// ─── Test Connection ────────────────────────────────────

/** Validate API key via GET /v1/accounts (confirmed endpoint) */
export async function testQuickMailConnection(apiKey: string): Promise<boolean> {
  try {
    await qmFetch(apiKey, "/v1/accounts");
    return true;
  } catch {
    return false;
  }
}

// ─── ESP Provider ───────────────────────────────────────

function notImplemented(method: string): never {
  throw new Error(
    `QuickMail: ${method} not yet implemented — QuickMail's API docs are not publicly available. ` +
    `Contact support@quickmail.io for API access.`,
  );
}

class QuickMailESP implements ESPProvider {
  readonly name = "QuickMail";
  constructor(private readonly apiKey: string) {}

  async listAccounts(): Promise<ESPAccount[]> {
    const data = (await qmFetch(this.apiKey, "/v1/accounts")) as Array<{
      id?: string;
      email?: string;
      name?: string;
    }> | null;

    return (data ?? []).map((a) => ({
      email: a.email ?? "",
      name: a.name,
    }));
  }

  async createCampaign(_params: CreateCampaignParams): Promise<ESPCampaign> {
    notImplemented("createCampaign");
  }

  async activateCampaign(_campaignId: string): Promise<void> {
    notImplemented("activateCampaign");
  }

  async pauseCampaign(_campaignId: string): Promise<void> {
    notImplemented("pauseCampaign");
  }

  async getCampaignStatus(_campaignId: string): Promise<CampaignSendingStatus> {
    notImplemented("getCampaignStatus");
  }

  async getCampaignAnalytics(_campaignId: string): Promise<CampaignAnalytics> {
    notImplemented("getCampaignAnalytics");
  }

  async getStepAnalytics(_campaignId: string): Promise<StepAnalytics[]> {
    notImplemented("getStepAnalytics");
  }

  async getLeadsPerformance(_campaignId: string, _limit: number, _cursor?: string): Promise<LeadPerformancePage> {
    notImplemented("getLeadsPerformance");
  }

  async addLeads(_campaignId: string, _leads: ESPLeadData[]): Promise<AddLeadsResult> {
    // Endpoint path inferred from Zapier "Create or Update Prospect" action
    // but NOT confirmed — may fail with 404
    notImplemented("addLeads");
  }

  async getEmails(_params: GetEmailsParams): Promise<GetEmailsResult> {
    notImplemented("getEmails");
  }

  async replyToEmail(_params: ReplyToEmailParams): Promise<ReplyToEmailResult> {
    return { error: "QuickMail does not expose a reply endpoint in its public API" };
  }

  async removeFromSequence(_params: RemoveFromSequenceParams): Promise<RemoveFromSequenceResult> {
    notImplemented("removeFromSequence");
  }

  async disableVariant(_campaignId: string, _stepIndex: number, _variantIndex: number): Promise<boolean> {
    return false;
  }
}

export function createQuickMailESP(apiKey: string): ESPProvider {
  return new QuickMailESP(apiKey);
}
