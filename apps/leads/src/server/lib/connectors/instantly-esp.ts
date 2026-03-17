/**
 * Instantly ESP Provider — wraps the raw Instantly connector
 * to implement the ESPProvider interface.
 */

import * as instantly from "./instantly";
import { logger } from "@/lib/logger";
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

export function createInstantlyESP(apiKey: string): ESPProvider {
  return {
    name: "instantly",

    async listAccounts(): Promise<ESPAccount[]> {
      const accounts = await instantly.listAccounts(apiKey);
      return accounts.map((a) => ({
        email: a.email,
        name: a.first_name ? `${a.first_name} ${a.last_name ?? ""}`.trim() : undefined,
        status: a.status === 1 ? "active" : "inactive",
        dailySendLimit: undefined,
      }));
    },

    async createCampaign(params: CreateCampaignParams): Promise<ESPCampaign> {
      const result = await instantly.createCampaign(apiKey, {
        name: params.name,
        steps: params.steps.map((s) => ({
          subject: s.subject,
          body: s.body,
          delay: s.delay,
          // Map subjectVariants to Instantly's subjects array for A/B testing
          ...(s.subjectVariants?.length ? { subjects: [s.subject, ...s.subjectVariants] } : {}),
        })),
        emailList: params.accountEmails,
        dailyLimit: params.dailyLimit,
      });
      return { id: result.id, name: result.name, status: String(result.status) };
    },

    async activateCampaign(campaignId: string): Promise<void> {
      await instantly.activateCampaign(apiKey, campaignId);
    },

    async pauseCampaign(campaignId: string): Promise<void> {
      await instantly.pauseCampaign(apiKey, campaignId);
    },

    async getCampaignStatus(campaignId: string): Promise<CampaignSendingStatus> {
      const status = await instantly.getCampaignSendingStatus(apiKey, campaignId);
      return {
        campaignId,
        status: status.in_progress > 0 ? "sending" : "idle",
        sent: status.completed ?? 0,
        raw: status,
      };
    },

    async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
      const analytics = await instantly.getCampaignAnalytics(apiKey, campaignId);
      return {
        campaignId,
        sent: analytics.emails_sent,
        opened: analytics.emails_read,
        openRate: analytics.emails_sent > 0
          ? analytics.emails_read / analytics.emails_sent
          : undefined,
        replied: analytics.replied,
        replyRate: analytics.emails_sent > 0
          ? analytics.replied / analytics.emails_sent
          : undefined,
        bounced: analytics.bounced,
        unsubscribed: analytics.unsubscribed,
        raw: analytics,
      };
    },

    async getStepAnalytics(campaignId: string): Promise<StepAnalytics[]> {
      const result = await instantly.getCampaignStepAnalytics(apiKey, campaignId);
      return result.steps;
    },

    async getLeadsPerformance(campaignId: string, limit: number, cursor?: string): Promise<LeadPerformancePage> {
      const result = await instantly.getLeadsWithPerformance(apiKey, campaignId, limit, cursor);
      return {
        items: result.items.map((l) => ({
          id: l.id,
          email: l.email,
          openCount: l.openCount,
          replyCount: l.replyCount,
          clickCount: l.clickCount,
          interestStatus: l.interestStatus,
          lastOpenAt: l.lastOpenAt,
          lastReplyAt: l.lastReplyAt,
        })),
        nextCursor: result.nextStartingAfter,
      };
    },

    async addLeads(campaignId: string, leads: ESPLeadData[]): Promise<AddLeadsResult> {
      let added = 0;
      for (const lead of leads) {
        await instantly.createLead(apiKey, {
          email: lead.email,
          firstName: lead.firstName,
          lastName: lead.lastName,
          companyName: lead.company,
          campaign: campaignId,
          customVariables: lead.customVariables,
        });
        added++;
      }
      return { added };
    },

    async getEmails(params: GetEmailsParams): Promise<GetEmailsResult> {
      const emailTypeMap: Record<string, string> = {
        sent: "1",
        received: "2",
      };
      const res = await instantly.getEmails(apiKey, {
        campaign_id: params.campaignId,
        email_type: params.emailType ? emailTypeMap[params.emailType] : undefined,
        limit: params.limit,
      });
      return {
        items: res.items.map((e) => ({
          id: e.id,
          from: e.from_address,
          to: e.to_address,
          subject: e.subject,
          preview: e.content_preview ?? undefined,
          timestamp: e.timestamp_created,
          isAutoReply: e.is_auto_reply === 1,
          aiInterest: e.ai_interest_value ?? undefined,
          threadId: e.thread_id,
        })),
        hasMore: !!res.next_starting_after,
      };
    },

    async replyToEmail(params: ReplyToEmailParams): Promise<ReplyToEmailResult> {
      try {
        const response = await fetch("https://api.instantly.ai/api/v2/emails/reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            reply_to_uuid: params.emailId,
            body: params.body,
          }),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          return { error: `Failed to send reply: ${response.status} ${errText.slice(0, 200)}` };
        }

        const data = await response.json();
        return { id: data.id ?? undefined };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },

    async removeFromSequence(params: RemoveFromSequenceParams): Promise<RemoveFromSequenceResult> {
      const interestMap: Record<string, number> = {
        interested: 1,
        not_interested: -1,
        meeting_booked: 2,
      };

      try {
        await instantly.updateLeadInterestStatus(apiKey, {
          leadId: params.leadEmail,
          interestStatus: interestMap[params.reason],
        });
        return { removed: true };
      } catch (err) {
        return { removed: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async disableVariant(campaignId: string, stepIndex: number, variantIndex: number): Promise<boolean> {
      try {
        const campaign = await instantly.getCampaign(apiKey, campaignId);

        if (!campaign.sequences?.[0]?.steps) {
          logger.warn("[instantly-esp] Campaign has no sequences", { campaignId });
          return false;
        }

        const sequences = campaign.sequences.map((seq: InstantlySequence) => ({
          ...seq,
          steps: seq.steps.map((step: InstantlyStep, sIdx: number) => ({
            ...step,
            variants: step.variants.map((variant: InstantlyVariant, vIdx: number) => ({
              ...variant,
              v_disabled: sIdx === stepIndex && vIdx === variantIndex ? true : variant.v_disabled ?? false,
            })),
          })),
        }));

        await instantly.updateCampaign(apiKey, campaignId, { sequences });
        return true;
      } catch (error) {
        logger.error("[instantly-esp] Failed to disable variant", {
          campaignId,
          stepIndex,
          variantIndex,
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    },
  };
}

/** Internal types for Instantly campaign structure */
interface InstantlyVariant {
  subject: string;
  body: string;
  v_disabled?: boolean;
}

interface InstantlyStep {
  variants: InstantlyVariant[];
  [key: string]: unknown;
}

interface InstantlySequence {
  steps: InstantlyStep[];
  [key: string]: unknown;
}
