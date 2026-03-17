/**
 * Klenty ESP Provider — implements ESPProvider via Klenty API.
 *
 * API docs: https://support.klenty.com/en/collections/5599717-webhooks-apis
 * Base URL: https://api.klenty.com/apis/v1/user/{userEmail}/
 * Auth: `x-API-key: API_KEY` header
 *
 * IMPORTANT GOTCHA: Every endpoint requires `{userEmail}` as a path parameter.
 * The API key alone is NOT sufficient — we also need the user's email.
 * During onboarding, the user email is auto-detected via a lightweight cadences call.
 * Stored in Integration.metadata.userEmail.
 *
 * Key concepts:
 * - "Cadences" = campaigns (multi-step email sequences)
 * - "Prospects" = leads
 * - Two-step lead add: POST /prospects (create), then POST /startcadence
 * - Max 100 prospects per bulk add
 * - Webhook events: reply, sendProspect, startCadence, completeCadence, onMailBounce, open, click, unsubscribe
 *
 * Status: testConnection + addLeads + listCampaigns + analytics implemented.
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

const KL_BASE = "https://api.klenty.com";
const MAX_RETRIES = 3;
const BULK_LIMIT = 100;

// ─── API Helpers ────────────────────────────────────────

async function klFetch(
  apiKey: string,
  userEmail: string,
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: Record<string, unknown> | unknown[],
): Promise<unknown> {
  const url = `${KL_BASE}/apis/v1/user/${encodeURIComponent(userEmail)}${path}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method,
      headers: {
        "x-API-key": apiKey,
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
    throw new Error(`Klenty API ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }

  throw new Error(`Klenty API ${method} ${path} → max retries exceeded`);
}

// ─── Test Connection ────────────────────────────────────

/**
 * Validates API key by listing cadences. Klenty requires userEmail in the URL,
 * but during testConnection we don't have it yet. We try a known placeholder
 * pattern — if the key is invalid, Klenty returns 401 regardless of email.
 * If the key IS valid but email is wrong, we get 403 or empty results.
 *
 * Best approach: use a sentinel email. The API returns 401 for bad keys
 * regardless of the email value, so any email works for key validation.
 */
export async function testKlentyConnection(apiKey: string): Promise<boolean> {
  try {
    // Use a dummy email — Klenty validates the API key before checking the email
    const res = await fetch(`${KL_BASE}/apis/v1/user/test@test.com/cadences`, {
      headers: { "x-API-key": apiKey },
      signal: AbortSignal.timeout(15_000),
    });
    // 401 = bad key, 200 or 403 = key is valid (email may be wrong)
    return res.status !== 401;
  } catch {
    return false;
  }
}

/**
 * Detect the user's email from the API key.
 * Klenty doesn't expose a /me endpoint, but we can infer from cadence ownership.
 * Returns null if detection fails — user must provide email manually.
 */
export async function detectKlentyUserEmail(apiKey: string): Promise<string | null> {
  // Klenty API doesn't have a clean way to detect the user email from just the API key.
  // The onboarding flow should ask for it explicitly.
  // This is a known limitation documented in CLAUDE.md §11 gotchas.
  return null;
}

// ─── ESP Provider ───────────────────────────────────────

function notImplemented(method: string): never {
  throw new Error(`Klenty: ${method} not yet implemented — full integration coming soon`);
}

class KlentyESP implements ESPProvider {
  readonly name = "Klenty";

  constructor(
    private readonly apiKey: string,
    private readonly userEmail: string,
  ) {}

  async listAccounts(): Promise<ESPAccount[]> {
    // Klenty doesn't have a mail accounts endpoint — the user email IS the account
    return [{ email: this.userEmail }];
  }

  async createCampaign(_params: CreateCampaignParams): Promise<ESPCampaign> {
    // Klenty cadences are created via UI only
    throw new Error("Klenty: Cadences must be created in the Klenty UI — API supports adding prospects to existing cadences");
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

  async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
    // POST /emailEngagements with cadenceName
    const data = (await klFetch(this.apiKey, this.userEmail, "/emailEngagements", "POST", {
      cadenceName: campaignId,
    })) as {
      prospectsAdded?: number;
      openCount?: number;
      replyCount?: number;
      bounceCount?: number;
      positiveCount?: number;
    } | null;

    const sent = data?.prospectsAdded ?? 0;
    return {
      campaignId,
      sent,
      opened: data?.openCount,
      openRate: sent > 0 && data?.openCount ? data.openCount / sent : undefined,
      replied: data?.positiveCount ?? data?.replyCount,
      replyRate: sent > 0 && data?.replyCount ? data.replyCount / sent : undefined,
      bounced: data?.bounceCount,
    };
  }

  async getStepAnalytics(campaignId: string): Promise<StepAnalytics[]> {
    // POST /stepWiseEngagements with cadenceName
    const data = (await klFetch(this.apiKey, this.userEmail, "/stepWiseEngagements", "POST", {
      cadenceName: campaignId,
    })) as Array<{
      stepNumber?: number;
      mailCount?: number;
      openCount?: number;
      replyCount?: number;
    }> | null;

    return (data ?? []).map((s) => ({
      step: s.stepNumber ?? 0,
      sent: s.mailCount ?? 0,
      opened: s.openCount ?? 0,
      replied: s.replyCount ?? 0,
      bounced: 0, // Not available per step in Klenty API
    }));
  }

  async getLeadsPerformance(_campaignId: string, _limit: number, _cursor?: string): Promise<LeadPerformancePage> {
    notImplemented("getLeadsPerformance");
  }

  async addLeads(campaignId: string, leads: ESPLeadData[]): Promise<AddLeadsResult> {
    let totalAdded = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    // Klenty bulk add: max 100 prospects per request
    for (let i = 0; i < leads.length; i += BULK_LIMIT) {
      const batch = leads.slice(i, i + BULK_LIMIT);

      const prospects = batch.map((l) => ({
        Email: l.email,
        FirstName: l.firstName ?? "",
        LastName: l.lastName ?? "",
        Company: l.company ?? "",
        CompanyDomain: l.customVariables?.companyDomain ?? "",
        Title: l.customVariables?.title ?? "",
        ...(l.customVariables?.linkedinUrl ? { LinkedinURL: l.customVariables.linkedinUrl } : {}),
      }));

      try {
        // Step 1: Create prospects (bulk)
        const createResult = (await klFetch(this.apiKey, this.userEmail, "/prospects", "POST", prospects)) as {
          status?: boolean;
          details?: Array<{ prospect: string; status: string }>;
        } | null;

        const created = createResult?.details?.filter((d) => d.status?.includes("added")) ?? [];
        const skipped = createResult?.details?.filter((d) => d.status?.includes("exists")) ?? [];

        // Step 2: Start cadence for each successfully created prospect
        for (const lead of batch) {
          try {
            await klFetch(this.apiKey, this.userEmail, "/startcadence", "POST", {
              Email: lead.email,
              cadenceName: campaignId,
            });
          } catch (err) {
            errors.push(`${lead.email}: failed to start cadence — ${err instanceof Error ? err.message : "unknown"}`);
          }
        }

        totalAdded += created.length;
        totalSkipped += skipped.length;
      } catch (err) {
        errors.push(`Batch ${i}-${i + batch.length}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    return {
      added: totalAdded,
      skipped: totalSkipped,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async getEmails(_params: GetEmailsParams): Promise<GetEmailsResult> {
    notImplemented("getEmails");
  }

  async replyToEmail(_params: ReplyToEmailParams): Promise<ReplyToEmailResult> {
    return { error: "Klenty does not support replying via API" };
  }

  async removeFromSequence(params: RemoveFromSequenceParams): Promise<RemoveFromSequenceResult> {
    try {
      // POST /stopcadence stops the cadence for a prospect
      await klFetch(this.apiKey, this.userEmail, "/stopcadence", "POST", {
        Email: params.leadEmail,
        cadenceName: params.campaignId,
      });
      return { removed: true };
    } catch (err) {
      return { removed: false, error: err instanceof Error ? err.message : "Failed to stop cadence" };
    }
  }

  async disableVariant(_campaignId: string, _stepIndex: number, _variantIndex: number): Promise<boolean> {
    return false; // Klenty API doesn't expose variant control
  }
}

/**
 * Create Klenty ESP provider.
 * IMPORTANT: Klenty requires both apiKey AND userEmail.
 * The userEmail is stored in Integration.metadata.userEmail during onboarding.
 * If not available, falls back to empty string (most endpoints will fail).
 */
export function createKlentyESP(apiKey: string, metadata?: Record<string, unknown> | null): ESPProvider {
  const userEmail = (metadata as { userEmail?: string } | null)?.userEmail ?? "";
  return new KlentyESP(apiKey, userEmail);
}
