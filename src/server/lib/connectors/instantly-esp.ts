/**
 * Instantly ESP Provider — wraps the raw Instantly connector
 * to implement the ESPProvider interface.
 */

import * as instantly from "./instantly";
import type {
  ESPProvider,
  ESPAccount,
  ESPCampaign,
  CreateCampaignParams,
  CampaignSendingStatus,
  CampaignAnalytics,
  AddLeadsResult,
  ESPLeadData,
  GetEmailsParams,
  GetEmailsResult,
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
  };
}
