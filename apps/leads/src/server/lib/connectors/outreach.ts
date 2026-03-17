/**
 * Outreach ESP Connector — OAuth + PKCE, JSON API 1.0 format.
 *
 * API docs: https://api.outreach.io/api/v2
 * Auth: OAuth 2.0 with PKCE
 * Access token: 2h lifespan
 * Refresh token: 14-day rotation
 *
 * Maps Outreach "Sequences" to the ESPProvider "Campaign" abstraction.
 * JSON API 1.0 envelope: { data: { type, id, attributes } }
 */

import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";
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
} from "../providers/esp-provider";

// ─── Constants ──────────────────────────────────────────

const OUTREACH_AUTH_URL = "https://api.outreach.io/oauth/authorize";
const OUTREACH_TOKEN_URL = "https://api.outreach.io/oauth/token";
const OUTREACH_BASE = "https://api.outreach.io/api/v2";
const REQUEST_TIMEOUT = 15_000;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;
/** Add-to-sequence delay to avoid rate limits (200ms between individual prospect creates) */
const LEAD_ADD_DELAY_MS = 200;

// ─── Zod Schemas for JSON API 1.0 responses ─────────────

const jsonApiResourceSchema = z.object({
  type: z.string(),
  id: z.coerce.string(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  relationships: z.record(z.string(), z.unknown()).optional(),
});

const jsonApiSingleSchema = z.object({
  data: jsonApiResourceSchema,
});

const jsonApiListSchema = z.object({
  data: z.array(jsonApiResourceSchema),
  meta: z.object({
    page: z.object({
      current: z.number().optional(),
      entries: z.number().optional(),
      maxEntries: z.number().optional(),
      maxSize: z.number().optional(),
      size: z.number().optional(),
    }).optional(),
    count: z.number().optional(),
  }).optional(),
  links: z.object({
    next: z.string().nullish(),
    prev: z.string().nullish(),
  }).optional(),
});

const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  token_type: z.string().optional(),
});

// ─── OAuth Helpers ──────────────────────────────────────

/**
 * Build the Outreach OAuth authorization URL with PKCE.
 */
export function getAuthUrl(
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    scope: "prospects.all sequences.all sequenceStates.all mailboxes.all accounts.all",
  });
  return `${OUTREACH_AUTH_URL}?${params}`;
}

/**
 * Exchange an authorization code for tokens (with PKCE code_verifier).
 */
export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const res = await fetch(OUTREACH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Outreach OAuth exchange failed: ${res.status} ${text.slice(0, 300)}`);
  }

  const raw = await res.json();
  const parsed = tokenResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Outreach OAuth response validation failed: ${parsed.error.message}`);
  }

  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
    expiresIn: parsed.data.expires_in,
  };
}

// ─── Token Management ───────────────────────────────────

async function refreshAccessToken(integration: {
  id: string;
  refreshToken: string | null;
}): Promise<string> {
  if (!integration.refreshToken) {
    throw new Error("No refresh token available for Outreach");
  }

  const clientId = process.env.OUTREACH_CLIENT_ID;
  const clientSecret = process.env.OUTREACH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Outreach OAuth credentials not configured (OUTREACH_CLIENT_ID / OUTREACH_CLIENT_SECRET)");
  }

  const decryptedRefresh = decrypt(integration.refreshToken);

  const res = await fetch(OUTREACH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptedRefresh,
      client_id: clientId,
      client_secret: clientSecret,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Outreach token refresh failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const raw = await res.json();
  const parsed = tokenResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Outreach refresh response validation failed: ${parsed.error.message}`);
  }

  // Persist new tokens encrypted
  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      accessToken: encrypt(parsed.data.access_token),
      refreshToken: encrypt(parsed.data.refresh_token),
      expiresAt: new Date(Date.now() + parsed.data.expires_in * 1000),
    },
  });

  logger.debug("[outreach] Access token refreshed successfully");
  return parsed.data.access_token;
}

async function getAccessToken(workspaceId: string): Promise<string> {
  const integration = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId, type: "OUTREACH" } },
  });

  if (!integration?.accessToken) {
    throw new Error("Outreach not connected");
  }

  // Auto-refresh if expires within 5 minutes
  if (integration.expiresAt && integration.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    return refreshAccessToken(integration);
  }

  return decrypt(integration.accessToken);
}

// ─── API Client ─────────────────────────────────────────

/**
 * JSON API 1.0 fetch with retry + backoff.
 */
async function outreachFetch(
  accessToken: string,
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: Record<string, unknown>,
): Promise<unknown> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${OUTREACH_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/vnd.api+json",
          Accept: "application/vnd.api+json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await sleep(Math.pow(2, attempt) * BASE_DELAY_MS);
        continue;
      }
      throw new Error(
        `Outreach ${method} ${path} failed: ${err instanceof Error ? err.message : "network error"}`,
      );
    }

    if (res.ok) {
      const contentType = res.headers.get("content-type");
      if (!contentType?.includes("json")) return {};
      return res.json();
    }

    // Retry on 429 or 5xx
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      const retryAfter = res.headers.get("retry-after");
      const delay = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.pow(2, attempt) * BASE_DELAY_MS;
      await sleep(delay);
      continue;
    }

    const text = await res.text().catch(() => "");
    throw new Error(`Outreach ${method} ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }

  throw new Error(`Outreach ${method} ${path} failed after ${MAX_RETRIES} retries`);
}

// ─── Connection Test ────────────────────────────────────

export async function testOutreachConnection(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${OUTREACH_BASE}/mailboxes?page[size]=1`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.api+json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── ESP Provider Implementation ────────────────────────

export function createOutreachESP(workspaceId: string): ESPProvider {
  return {
    name: "outreach",

    async listAccounts(): Promise<ESPAccount[]> {
      try {
        const token = await getAccessToken(workspaceId);
        const raw = await outreachFetch(token, "/mailboxes?page[size]=100");
        const parsed = jsonApiListSchema.safeParse(raw);
        if (!parsed.success) {
          logger.warn(`[outreach] Mailboxes response validation failed: ${parsed.error.message}`);
          return [];
        }

        return parsed.data.data.map((mb) => ({
          email: String(mb.attributes?.["email"] ?? ""),
          name: mb.attributes?.["sendingName"] as string | undefined,
          status: mb.attributes?.["sendingEnabled"] ? "active" : "inactive",
        }));
      } catch (err) {
        logger.error(`[outreach] listAccounts failed: ${err instanceof Error ? err.message : String(err)}`);
        return [];
      }
    },

    async createCampaign(params: CreateCampaignParams): Promise<ESPCampaign> {
      const token = await getAccessToken(workspaceId);

      // Step 1: Create the sequence
      const seqBody = {
        data: {
          type: "sequence",
          attributes: {
            name: params.name,
            sequenceType: "email",
            enabled: false, // Start paused — caller will activateCampaign() later
          },
        },
      };

      const seqRaw = await outreachFetch(token, "/sequences", "POST", seqBody);
      const seqParsed = jsonApiSingleSchema.safeParse(seqRaw);
      if (!seqParsed.success) {
        throw new Error(`Outreach create sequence validation failed: ${seqParsed.error.message}`);
      }

      const sequenceId = seqParsed.data.data.id;

      // Step 2: Create sequence steps for each email step
      for (let i = 0; i < params.steps.length; i++) {
        const step = params.steps[i];
        const stepBody = {
          data: {
            type: "sequenceStep",
            attributes: {
              stepType: "auto_email",
              interval: step.delay,
              order: i + 1,
              taskNote: step.subject,
            },
            relationships: {
              sequence: {
                data: { type: "sequence", id: parseInt(sequenceId, 10) },
              },
            },
          },
        };

        const stepRaw = await outreachFetch(token, "/sequenceSteps", "POST", stepBody);
        const stepParsed = jsonApiSingleSchema.safeParse(stepRaw);
        if (!stepParsed.success) {
          logger.warn(
            `[outreach] Create sequence step ${i} validation failed: ${stepParsed.error.message}`,
          );
          continue;
        }

        // Create template for the step
        const templateBody = {
          data: {
            type: "sequenceTemplate",
            attributes: {
              subject: step.subject,
              bodyHtml: step.body,
              isReply: i > 0,
            },
            relationships: {
              sequenceStep: {
                data: { type: "sequenceStep", id: parseInt(stepParsed.data.data.id, 10) },
              },
            },
          },
        };

        try {
          await outreachFetch(token, "/sequenceTemplates", "POST", templateBody);
        } catch (err) {
          logger.warn(
            `[outreach] Create template for step ${i} failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      return {
        id: sequenceId,
        name: params.name,
        status: "paused",
      };
    },

    async activateCampaign(campaignId: string): Promise<void> {
      const token = await getAccessToken(workspaceId);
      await outreachFetch(token, `/sequences/${campaignId}`, "PATCH", {
        data: {
          type: "sequence",
          id: parseInt(campaignId, 10),
          attributes: { enabled: true },
        },
      });
    },

    async pauseCampaign(campaignId: string): Promise<void> {
      const token = await getAccessToken(workspaceId);
      await outreachFetch(token, `/sequences/${campaignId}`, "PATCH", {
        data: {
          type: "sequence",
          id: parseInt(campaignId, 10),
          attributes: { enabled: false },
        },
      });
    },

    async getCampaignStatus(campaignId: string): Promise<CampaignSendingStatus> {
      const token = await getAccessToken(workspaceId);
      const raw = await outreachFetch(token, `/sequences/${campaignId}`);
      const parsed = jsonApiSingleSchema.safeParse(raw);

      if (!parsed.success) {
        throw new Error(`Outreach getCampaignStatus validation failed: ${parsed.error.message}`);
      }

      const attrs = parsed.data.data.attributes ?? {};
      const enabled = attrs["enabled"] as boolean | undefined;

      return {
        campaignId,
        status: enabled ? "active" : "paused",
        sent: typeof attrs["deliverCount"] === "number" ? (attrs["deliverCount"] as number) : undefined,
        opened: typeof attrs["openCount"] === "number" ? (attrs["openCount"] as number) : undefined,
        replied: typeof attrs["replyCount"] === "number" ? (attrs["replyCount"] as number) : undefined,
        bounced: typeof attrs["bounceCount"] === "number" ? (attrs["bounceCount"] as number) : undefined,
        raw: attrs,
      };
    },

    async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
      const token = await getAccessToken(workspaceId);
      const raw = await outreachFetch(token, `/sequences/${campaignId}`);
      const parsed = jsonApiSingleSchema.safeParse(raw);

      if (!parsed.success) {
        throw new Error(`Outreach getCampaignAnalytics validation failed: ${parsed.error.message}`);
      }

      const attrs = parsed.data.data.attributes ?? {};
      const sent = typeof attrs["deliverCount"] === "number" ? (attrs["deliverCount"] as number) : 0;
      const opened = typeof attrs["openCount"] === "number" ? (attrs["openCount"] as number) : 0;
      const replied = typeof attrs["replyCount"] === "number" ? (attrs["replyCount"] as number) : 0;
      const bounced = typeof attrs["bounceCount"] === "number" ? (attrs["bounceCount"] as number) : 0;
      const clicked = typeof attrs["clickCount"] === "number" ? (attrs["clickCount"] as number) : 0;

      return {
        campaignId,
        sent,
        opened,
        openRate: sent > 0 ? opened / sent : undefined,
        replied,
        replyRate: sent > 0 ? replied / sent : undefined,
        bounced,
        clicked,
        raw: attrs,
      };
    },

    async getStepAnalytics(campaignId: string): Promise<StepAnalytics[]> {
      try {
        const token = await getAccessToken(workspaceId);
        const raw = await outreachFetch(
          token,
          `/sequenceSteps?filter[sequence][id]=${campaignId}&page[size]=100`,
        );
        const parsed = jsonApiListSchema.safeParse(raw);
        if (!parsed.success) {
          logger.warn(`[outreach] getStepAnalytics validation failed: ${parsed.error.message}`);
          return [];
        }

        return parsed.data.data.map((step, idx) => {
          const attrs = step.attributes ?? {};
          return {
            step: idx,
            sent: typeof attrs["deliverCount"] === "number" ? (attrs["deliverCount"] as number) : 0,
            opened: typeof attrs["openCount"] === "number" ? (attrs["openCount"] as number) : 0,
            replied: typeof attrs["replyCount"] === "number" ? (attrs["replyCount"] as number) : 0,
            bounced: typeof attrs["bounceCount"] === "number" ? (attrs["bounceCount"] as number) : 0,
          };
        });
      } catch (err) {
        logger.warn(`[outreach] getStepAnalytics failed: ${err instanceof Error ? err.message : String(err)}`);
        return [];
      }
    },

    async getLeadsPerformance(
      campaignId: string,
      limit: number,
      cursor?: string,
    ): Promise<LeadPerformancePage> {
      try {
        const token = await getAccessToken(workspaceId);
        let path = `/sequenceStates?filter[sequence][id]=${campaignId}&page[size]=${limit}`;
        if (cursor) {
          path += `&page[after]=${cursor}`;
        }

        const raw = await outreachFetch(token, path);
        const parsed = jsonApiListSchema.safeParse(raw);
        if (!parsed.success) {
          logger.warn(`[outreach] getLeadsPerformance validation failed: ${parsed.error.message}`);
          return { items: [] };
        }

        const items = parsed.data.data.map((state) => {
          const attrs = state.attributes ?? {};
          return {
            id: state.id,
            email: String(attrs["prospectEmail"] ?? ""),
            openCount: typeof attrs["openCount"] === "number" ? (attrs["openCount"] as number) : 0,
            replyCount: typeof attrs["replyCount"] === "number" ? (attrs["replyCount"] as number) : 0,
            clickCount: typeof attrs["clickCount"] === "number" ? (attrs["clickCount"] as number) : 0,
            interestStatus: null,
            lastOpenAt: null,
            lastReplyAt: null,
          };
        });

        const nextLink = parsed.data.links?.next;
        let nextCursor: string | undefined;
        if (nextLink) {
          const url = new URL(nextLink, OUTREACH_BASE);
          nextCursor = url.searchParams.get("page[after]") ?? undefined;
        }

        return { items, nextCursor };
      } catch (err) {
        logger.error(
          `[outreach] getLeadsPerformance failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        return { items: [] };
      }
    },

    async addLeads(campaignId: string, leads: ESPLeadData[]): Promise<AddLeadsResult> {
      const token = await getAccessToken(workspaceId);
      let added = 0;
      const errors: string[] = [];

      for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];
        if (i > 0) await sleep(LEAD_ADD_DELAY_MS);

        try {
          // Step 1: Create or find the prospect
          const prospectBody = {
            data: {
              type: "prospect",
              attributes: {
                emails: [lead.email],
                firstName: lead.firstName ?? "",
                lastName: lead.lastName ?? "",
                company: lead.company ?? undefined,
                custom: lead.customVariables ?? undefined,
              },
            },
          };

          const prospectRaw = await outreachFetch(token, "/prospects", "POST", prospectBody);
          const prospectParsed = jsonApiSingleSchema.safeParse(prospectRaw);
          if (!prospectParsed.success) {
            errors.push(`Failed to create prospect ${lead.email}: validation error`);
            continue;
          }

          const prospectId = parseInt(prospectParsed.data.data.id, 10);

          // Step 2: Add prospect to the sequence via sequenceState
          const stateBody = {
            data: {
              type: "sequenceState",
              relationships: {
                prospect: { data: { type: "prospect", id: prospectId } },
                sequence: { data: { type: "sequence", id: parseInt(campaignId, 10) } },
              },
            },
          };

          await outreachFetch(token, "/sequenceStates", "POST", stateBody);
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

      try {
        const token = await getAccessToken(workspaceId);
        const limit = params.limit ?? 50;
        const raw = await outreachFetch(
          token,
          `/mailings?filter[sequence][id]=${params.campaignId}&page[size]=${limit}`,
        );
        const parsed = jsonApiListSchema.safeParse(raw);
        if (!parsed.success) {
          logger.warn(`[outreach] getEmails validation failed: ${parsed.error.message}`);
          return { items: [], hasMore: false };
        }

        const items = parsed.data.data.map((m) => {
          const attrs = m.attributes ?? {};
          return {
            id: m.id,
            from: attrs["fromAddress"] as string | undefined,
            to: attrs["toAddress"] as string | undefined,
            subject: attrs["subject"] as string | undefined,
            preview: attrs["bodyText"]
              ? String(attrs["bodyText"]).slice(0, 200)
              : undefined,
            timestamp: attrs["deliveredAt"] as string | undefined,
            isAutoReply: false,
          };
        });

        const hasMore = !!parsed.data.links?.next;
        return { items, hasMore };
      } catch (err) {
        logger.error(`[outreach] getEmails failed: ${err instanceof Error ? err.message : String(err)}`);
        return { items: [], hasMore: false };
      }
    },

    async replyToEmail(_params: ReplyToEmailParams): Promise<ReplyToEmailResult> {
      // Outreach does not support sending arbitrary replies via API.
      // Replies are managed through the Outreach UI or mailbox sync.
      return {
        error: "Reply via API is not supported by Outreach. Please reply from the Outreach UI.",
      };
    },

    async removeFromSequence(params: RemoveFromSequenceParams): Promise<RemoveFromSequenceResult> {
      try {
        const token = await getAccessToken(workspaceId);

        // Find the sequenceState for this prospect + sequence
        const raw = await outreachFetch(
          token,
          `/sequenceStates?filter[sequence][id]=${params.campaignId}` +
            `&filter[prospect][emails]=${encodeURIComponent(params.leadEmail)}` +
            `&page[size]=1`,
        );
        const parsed = jsonApiListSchema.safeParse(raw);
        if (!parsed.success || parsed.data.data.length === 0) {
          return {
            removed: false,
            error: `No sequence state found for ${params.leadEmail} in sequence ${params.campaignId}`,
          };
        }

        const stateId = parsed.data.data[0].id;

        // Set state to "finished" to remove from active sequence
        await outreachFetch(token, `/sequenceStates/${stateId}`, "PATCH", {
          data: {
            type: "sequenceState",
            id: parseInt(stateId, 10),
            attributes: { state: "finished" },
          },
        });

        return { removed: true };
      } catch (err) {
        return {
          removed: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },

    async disableVariant(
      _campaignId: string,
      _stepIndex: number,
      _variantIndex: number,
    ): Promise<boolean> {
      // Outreach does not expose A/B variant management via API.
      return false;
    },
  };
}
