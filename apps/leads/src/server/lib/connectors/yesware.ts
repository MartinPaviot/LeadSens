/**
 * Yesware ESP Provider — implements ESPProvider via Yesware API.
 *
 * API docs: https://developer.yesware.com
 * Auth: `Authorization: Bearer API_KEY` header
 *
 * Note: Yesware is primarily an email tracking tool inside Gmail/Outlook.
 * Campaign/sequence capabilities are more limited than dedicated cold email tools.
 *
 * Status: Stub — testConnection + addLeads implemented.
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

const YW_BASE = "https://api.yesware.com";
const MAX_RETRIES = 3;

// ─── API Helpers ────────────────────────────────────────

async function ywFetch(
  apiKey: string,
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: Record<string, unknown>,
): Promise<unknown> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${YW_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
    throw new Error(`Yesware API ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }

  throw new Error(`Yesware API ${method} ${path} → max retries exceeded`);
}

// ─── Test Connection ────────────────────────────────────

export async function testYeswareConnection(apiKey: string): Promise<boolean> {
  try {
    await ywFetch(apiKey, "/v1/me");
    return true;
  } catch {
    return false;
  }
}

// ─── ESP Provider ───────────────────────────────────────

function notImplemented(method: string): never {
  throw new Error(`Yesware: ${method} not yet implemented — full integration coming soon`);
}

class YeswareESP implements ESPProvider {
  readonly name = "Yesware";
  constructor(private readonly apiKey: string) {}

  async listAccounts(): Promise<ESPAccount[]> {
    notImplemented("listAccounts");
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

  async addLeads(campaignId: string, leads: ESPLeadData[]): Promise<AddLeadsResult> {
    const recipients = leads.map((l) => ({
      email: l.email,
      first_name: l.firstName ?? "",
      last_name: l.lastName ?? "",
      company: l.company ?? "",
      ...(l.customVariables ?? {}),
    }));

    const result = (await ywFetch(this.apiKey, `/v1/campaigns/${campaignId}/recipients`, "POST", {
      recipients,
    })) as { added?: number; skipped?: number } | null;

    return {
      added: result?.added ?? leads.length,
      skipped: result?.skipped ?? 0,
    };
  }

  async getEmails(_params: GetEmailsParams): Promise<GetEmailsResult> {
    notImplemented("getEmails");
  }

  async replyToEmail(_params: ReplyToEmailParams): Promise<ReplyToEmailResult> {
    return { error: "Yesware does not support replying via API" };
  }

  async removeFromSequence(_params: RemoveFromSequenceParams): Promise<RemoveFromSequenceResult> {
    notImplemented("removeFromSequence");
  }

  async disableVariant(_campaignId: string, _stepIndex: number, _variantIndex: number): Promise<boolean> {
    return false;
  }
}

export function createYeswareESP(apiKey: string): ESPProvider {
  return new YeswareESP(apiKey);
}
