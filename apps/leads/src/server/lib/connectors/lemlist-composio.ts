/**
 * Lemlist Composio ESP Provider — implements ESPProvider via Composio-managed Lemlist.
 *
 * Replaces direct HTTP calls in lemlist.ts with Composio action execution.
 *
 * Composio actions used:
 * - LEMLIST_GET_TEAM_INFO                          — get team info (for teamId)
 * - LEMLIST_GET_LIST_TEAM_SENDERS                  — list email accounts
 * - LEMLIST_POST_CREATE_CAMPAIGN                   — create campaign
 * - LEMLIST_POST_ADD_STEP_TO_SEQUENCE              — add step to campaign sequence
 * - LEMLIST_POST_PAUSE_CAMPAIGN                    — pause campaign
 * - LEMLIST_GET_CAMPAIGN_STATS                     — get campaign stats
 * - LEMLIST_GET_CAMPAIGN_BY_ID                     — get campaign details
 * - LEMLIST_POST_CREATE_LEAD_IN_CAMPAIGN           — add lead to campaign
 * - LEMLIST_GET_RETRIEVE_ACTIVITIES                — get email activities
 * - LEMLIST_DELETE_UNSUBSCRIBE_LEAD_FROM_CAMPAIGN  — remove lead from campaign
 *
 * Known gaps (no Composio action available):
 * - activateCampaign — no action to start a Lemlist campaign
 * - replyToEmail     — no action to reply via Lemlist API
 */

import { executeAction } from "@/server/lib/composio/execute";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";
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

// ─── Composio Response Types ─────────────────────────────

interface LemlistTeamInfo {
  _id?: string;
  name?: string;
}

interface LemlistSender {
  _id?: string;
  email?: string;
  name?: string;
  isPaused?: boolean;
  dailyLimit?: number;
}

interface LemlistCampaignResponse {
  _id?: string;
  campaignId?: string;
  name?: string;
}

interface LemlistCampaignStepStats {
  sent?: number;
  opened?: number;
  replied?: number;
  bounced?: number;
}

interface LemlistCampaignStats {
  _id?: string;
  name?: string;
  status?: string;
  stats?: {
    sent?: number;
    opened?: number;
    clicked?: number;
    replied?: number;
    bounced?: number;
    unsubscribed?: number;
  };
  sequences?: Array<{
    stepNumber?: number;
    stats?: LemlistCampaignStepStats;
  }>;
}

interface LemlistLeadResponse {
  _id?: string;
  email?: string;
  openCount?: number;
  replyCount?: number;
  clickCount?: number;
  lastOpenedAt?: string;
  lastRepliedAt?: string;
}

interface LemlistActivity {
  _id?: string;
  type?: string;
  leadEmail?: string;
  senderEmail?: string;
  subject?: string;
  snippet?: string;
  createdAt?: string;
  isAutoReply?: boolean;
}

// ─── Internal Helpers ────────────────────────────────────

/**
 * Extract data from a Composio response that may be wrapped in { data: ... }
 * or returned directly. Returns undefined if nothing found.
 */
function extractCampaignResponse(
  result: LemlistCampaignResponse | { data?: LemlistCampaignResponse } | null | undefined,
): LemlistCampaignResponse | undefined {
  if (!result) return undefined;
  if ("data" in result && typeof (result as { data?: unknown }).data === "object") {
    return (result as { data?: LemlistCampaignResponse }).data ?? undefined;
  }
  return result as LemlistCampaignResponse;
}

function extractCampaignStats(
  result: LemlistCampaignStats | { data?: LemlistCampaignStats } | null | undefined,
): LemlistCampaignStats | undefined {
  if (!result) return undefined;
  if ("data" in result && typeof (result as { data?: unknown }).data === "object") {
    return (result as { data?: LemlistCampaignStats }).data ?? undefined;
  }
  return result as LemlistCampaignStats;
}

function extractTeamInfo(
  result: LemlistTeamInfo | { data?: LemlistTeamInfo } | null | undefined,
): LemlistTeamInfo | undefined {
  if (!result) return undefined;
  if ("data" in result && typeof (result as { data?: unknown }).data === "object") {
    return (result as { data?: LemlistTeamInfo }).data ?? undefined;
  }
  return result as LemlistTeamInfo;
}

function extractArray<T>(result: T[] | { data?: T[] } | null | undefined): T[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if ("data" in result && Array.isArray(result.data)) return result.data;
  return [];
}

/**
 * Resolve Lemlist teamId by calling GET_TEAM_INFO.
 * The teamId is required for creating campaigns.
 */
async function resolveTeamId(workspaceId: string): Promise<string> {
  try {
    const result = await executeAction<
      LemlistTeamInfo | { data?: LemlistTeamInfo }
    >(
      "LEMLIST_GET_TEAM_INFO",
      workspaceId,
      {},
    );

    const team = extractTeamInfo(result);
    const teamId = team?._id;

    if (!teamId) {
      throw new AppError(
        "Lemlist team info returned no team ID",
        "CONNECTOR_ERROR",
      );
    }

    logger.info("[lemlist-composio] Resolved teamId", {
      workspaceId,
      teamId,
    });

    return teamId;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      `Failed to resolve Lemlist teamId: ${err instanceof Error ? err.message : String(err)}`,
      "CONNECTOR_ERROR",
    );
  }
}

// ─── Factory ─────────────────────────────────────────────

/**
 * Create a Lemlist ESP provider backed by Composio.
 *
 * This is async because it needs to resolve the teamId by calling
 * LEMLIST_GET_TEAM_INFO on initialization. The teamId is cached
 * for the lifetime of the provider instance.
 */
export async function createLemlistComposioESP(
  workspaceId: string,
): Promise<ESPProvider> {
  // Resolve teamId once on creation
  const teamId = await resolveTeamId(workspaceId);

  return {
    name: "lemlist",

    async listAccounts(): Promise<ESPAccount[]> {
      try {
        const result = await executeAction<
          LemlistSender[] | { data?: LemlistSender[] }
        >(
          "LEMLIST_GET_LIST_TEAM_SENDERS",
          workspaceId,
          {},
        );

        const senders = extractArray<LemlistSender>(result);

        return senders.map(
          (s): ESPAccount => ({
            email: s.email ?? "",
            name: s.name ?? undefined,
            status: s.isPaused ? "paused" : "active",
            dailySendLimit: s.dailyLimit ?? undefined,
          }),
        );
      } catch (err) {
        logger.warn("[lemlist-composio] Failed to list accounts", {
          workspaceId,
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }
    },

    async createCampaign(params: CreateCampaignParams): Promise<ESPCampaign> {
      // Step 1: Create the campaign
      const createResult = await executeAction<
        LemlistCampaignResponse | { data?: LemlistCampaignResponse }
      >(
        "LEMLIST_POST_CREATE_CAMPAIGN",
        workspaceId,
        { name: params.name, teamId },
      );

      const campaignData = extractCampaignResponse(createResult);
      const campaignId = campaignData?._id ?? campaignData?.campaignId;
      if (!campaignId) {
        throw new AppError(
          "Lemlist campaign creation returned no ID",
          "CONNECTOR_ERROR",
        );
      }

      // Step 2: Add sequence steps one at a time
      for (let i = 0; i < params.steps.length; i++) {
        const step = params.steps[i];
        try {
          await executeAction(
            "LEMLIST_POST_ADD_STEP_TO_SEQUENCE",
            workspaceId,
            {
              campaignId,
              type: "email",
              subject: step.subject,
              html: step.body,
              delay: i === 0 ? 0 : step.delay,
              delayUnit: "days",
            },
          );
        } catch (err) {
          logger.warn("[lemlist-composio] Failed to add step to sequence", {
            workspaceId,
            campaignId,
            stepIndex: i,
            error: err instanceof Error ? err.message : String(err),
          });
          // Continue adding remaining steps even if one fails
        }
      }

      return { id: campaignId, name: params.name, status: "draft" };
    },

    async activateCampaign(_campaignId: string): Promise<void> {
      // GAP: No Composio action for starting a Lemlist campaign
      throw new AppError(
        "activateCampaign is not available via Composio for Lemlist. " +
          "Please start the campaign from the Lemlist UI, or use the direct API connector.",
        "NOT_IMPLEMENTED",
        501,
      );
    },

    async pauseCampaign(campaignId: string): Promise<void> {
      await executeAction(
        "LEMLIST_POST_PAUSE_CAMPAIGN",
        workspaceId,
        { campaignId },
      );
    },

    async getCampaignStatus(campaignId: string): Promise<CampaignSendingStatus> {
      const result = await executeAction<
        LemlistCampaignStats | { data?: LemlistCampaignStats }
      >(
        "LEMLIST_GET_CAMPAIGN_STATS",
        workspaceId,
        { campaignId },
      );

      const data = extractCampaignStats(result);
      const stats = data?.stats;

      return {
        campaignId,
        status: data?.status ?? "unknown",
        sent: stats?.sent ?? 0,
        opened: stats?.opened ?? 0,
        replied: stats?.replied ?? 0,
        bounced: stats?.bounced ?? 0,
        raw: data,
      };
    },

    async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
      const result = await executeAction<
        LemlistCampaignStats | { data?: LemlistCampaignStats }
      >(
        "LEMLIST_GET_CAMPAIGN_STATS",
        workspaceId,
        { campaignId },
      );

      const data = extractCampaignStats(result);
      const stats = data?.stats;
      const sent = stats?.sent ?? 0;

      return {
        campaignId,
        sent,
        opened: stats?.opened ?? 0,
        openRate: sent > 0 ? (stats?.opened ?? 0) / sent : undefined,
        replied: stats?.replied ?? 0,
        replyRate: sent > 0 ? (stats?.replied ?? 0) / sent : undefined,
        bounced: stats?.bounced ?? 0,
        clicked: stats?.clicked ?? 0,
        unsubscribed: stats?.unsubscribed ?? 0,
        raw: data,
      };
    },

    async getStepAnalytics(campaignId: string): Promise<StepAnalytics[]> {
      const result = await executeAction<
        LemlistCampaignStats | { data?: LemlistCampaignStats }
      >(
        "LEMLIST_GET_CAMPAIGN_BY_ID",
        workspaceId,
        { campaignId },
      );

      const data = extractCampaignStats(result);
      const sequences = data?.sequences;

      if (!Array.isArray(sequences)) return [];

      return sequences.map(
        (seq): StepAnalytics => ({
          step: (seq.stepNumber ?? 1) - 1, // 1-indexed to 0-indexed
          sent: seq.stats?.sent ?? 0,
          opened: seq.stats?.opened ?? 0,
          replied: seq.stats?.replied ?? 0,
          bounced: seq.stats?.bounced ?? 0,
        }),
      );
    },

    async getLeadsPerformance(
      campaignId: string,
      limit: number,
      cursor?: string,
    ): Promise<LeadPerformancePage> {
      const offset = cursor ? parseInt(cursor, 10) : 0;

      try {
        const result = await executeAction<
          LemlistLeadResponse[] | { data?: LemlistLeadResponse[] }
        >(
          "LEMLIST_GET_EXPORT_CAMPAIGN_LEADS",
          workspaceId,
          { campaignId, limit, offset },
        );

        const leads = extractArray<LemlistLeadResponse>(result);

        const items = leads.map((l) => ({
          id: l._id ?? "",
          email: l.email ?? "",
          openCount: l.openCount ?? 0,
          replyCount: l.replyCount ?? 0,
          clickCount: l.clickCount ?? 0,
          interestStatus: null,
          lastOpenAt: l.lastOpenedAt ?? null,
          lastReplyAt: l.lastRepliedAt ?? null,
        }));

        return {
          items,
          nextCursor:
            items.length >= limit ? String(offset + limit) : undefined,
        };
      } catch (err) {
        logger.warn("[lemlist-composio] Failed to get leads performance", {
          workspaceId,
          campaignId,
          error: err instanceof Error ? err.message : String(err),
        });
        return { items: [] };
      }
    },

    async addLeads(
      campaignId: string,
      leads: ESPLeadData[],
    ): Promise<AddLeadsResult> {
      // Lemlist adds leads one at a time via Composio
      let added = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const lead of leads) {
        try {
          await executeAction(
            "LEMLIST_POST_CREATE_LEAD_IN_CAMPAIGN",
            workspaceId,
            {
              campaignId,
              email: lead.email,
              firstName: lead.firstName ?? "",
              lastName: lead.lastName ?? "",
              companyName: lead.company ?? "",
              ...(lead.customVariables ?? {}),
            },
          );
          added++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("409") || msg.includes("already") || msg.includes("duplicate")) {
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
      try {
        const args: Record<string, unknown> = {};
        if (params.campaignId) args.campaignId = params.campaignId;
        if (params.emailType === "sent") args.type = "emailsSent";
        if (params.emailType === "received") args.type = "emailsReplied";
        if (params.limit) args.limit = params.limit;

        const result = await executeAction<
          LemlistActivity[] | { data?: LemlistActivity[] }
        >(
          "LEMLIST_GET_RETRIEVE_ACTIVITIES",
          workspaceId,
          args,
        );

        const activities = extractArray<LemlistActivity>(result);

        const items = activities.map((a) => ({
          id: a._id ?? "",
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
      } catch (err) {
        logger.warn("[lemlist-composio] Failed to get emails", {
          workspaceId,
          error: err instanceof Error ? err.message : String(err),
        });
        return { items: [], hasMore: false };
      }
    },

    async replyToEmail(_params: ReplyToEmailParams): Promise<ReplyToEmailResult> {
      // GAP: No Composio action for replying via Lemlist
      return {
        error:
          "Reply via API is not available through Composio for Lemlist. " +
          "Please reply directly from the Lemlist UI.",
      };
    },

    async removeFromSequence(
      params: RemoveFromSequenceParams,
    ): Promise<RemoveFromSequenceResult> {
      try {
        await executeAction(
          "LEMLIST_DELETE_UNSUBSCRIBE_LEAD_FROM_CAMPAIGN",
          workspaceId,
          {
            campaignId: params.campaignId,
            email: params.leadEmail,
          },
        );
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
      // Lemlist does not support per-variant disabling via API.
      // A/B testing is managed at the campaign level in their UI.
      return false;
    },
  };
}
