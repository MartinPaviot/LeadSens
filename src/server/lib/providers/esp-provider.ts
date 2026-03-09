/**
 * ESPProvider — Abstraction for Email Sending Platforms.
 *
 * Implementations: Instantly, Smartlead, Lemlist
 * Each ESP implements this interface; tools call the interface, not the connector directly.
 */

// ─── Common Types ────────────────────────────────────────

export interface ESPAccount {
  email: string;
  name?: string;
  status?: string;
  dailySendLimit?: number;
}

export interface ESPCampaignStep {
  subject: string;
  body: string;
  delay: number; // days after previous step
}

export interface CreateCampaignParams {
  name: string;
  steps: ESPCampaignStep[];
  accountEmails: string[];
  dailyLimit?: number;
  timezone?: string;
}

export interface ESPCampaign {
  id: string;
  name: string;
  status?: string;
}

export interface ESPLeadData {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  customVariables?: Record<string, string>;
}

export interface AddLeadsResult {
  added: number;
  skipped?: number;
  errors?: string[];
}

export interface CampaignSendingStatus {
  campaignId: string;
  status: string;
  sent?: number;
  opened?: number;
  replied?: number;
  bounced?: number;
  raw?: unknown;
}

export interface CampaignAnalytics {
  campaignId: string;
  sent?: number;
  opened?: number;
  openRate?: number;
  replied?: number;
  replyRate?: number;
  bounced?: number;
  clicked?: number;
  unsubscribed?: number;
  raw?: unknown;
}

export interface ESPEmail {
  id: string;
  from?: string;
  to?: string;
  subject?: string;
  preview?: string;
  timestamp?: string;
  isAutoReply?: boolean;
  aiInterest?: number;
  threadId?: string;
}

export interface GetEmailsParams {
  campaignId?: string;
  emailType?: "sent" | "received" | "all";
  limit?: number;
}

export interface GetEmailsResult {
  items: ESPEmail[];
  hasMore: boolean;
}

// ─── Interface ───────────────────────────────────────────

export interface ESPProvider {
  readonly name: "instantly" | "smartlead" | "lemlist";

  // Accounts
  listAccounts(): Promise<ESPAccount[]>;

  // Campaigns
  createCampaign(params: CreateCampaignParams): Promise<ESPCampaign>;
  activateCampaign(campaignId: string): Promise<void>;
  pauseCampaign(campaignId: string): Promise<void>;
  getCampaignStatus(campaignId: string): Promise<CampaignSendingStatus>;
  getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics>;

  // Leads
  addLeads(campaignId: string, leads: ESPLeadData[]): Promise<AddLeadsResult>;

  // Emails
  getEmails(params: GetEmailsParams): Promise<GetEmailsResult>;
}
