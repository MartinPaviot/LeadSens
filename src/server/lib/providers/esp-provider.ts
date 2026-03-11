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
  subjectVariants?: string[]; // A/B test subject variants
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

export interface StepAnalytics {
  step: number;
  sent: number;
  opened: number;
  replied: number;
  bounced: number;
}

export interface LeadPerformance {
  id: string;
  email: string;
  openCount: number;
  replyCount: number;
  clickCount: number;
  interestStatus: number | null;
  lastOpenAt: string | null;
  lastReplyAt: string | null;
}

export interface LeadPerformancePage {
  items: LeadPerformance[];
  nextCursor?: string;
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

// ─── Reply / Sequence Types ─────────────────────────────

export interface ReplyToEmailParams {
  emailId: string;
  campaignId: string;
  body: string;
}

export interface ReplyToEmailResult {
  id?: string;
  error?: string;
}

export interface RemoveFromSequenceParams {
  leadEmail: string;
  campaignId: string;
  reason: "interested" | "not_interested" | "meeting_booked";
}

export interface RemoveFromSequenceResult {
  removed: boolean;
  error?: string;
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
  getStepAnalytics(campaignId: string): Promise<StepAnalytics[]>;
  getLeadsPerformance(campaignId: string, limit: number, cursor?: string): Promise<LeadPerformancePage>;

  // Leads
  addLeads(campaignId: string, leads: ESPLeadData[]): Promise<AddLeadsResult>;

  // Emails
  getEmails(params: GetEmailsParams): Promise<GetEmailsResult>;

  // Reply management
  replyToEmail(params: ReplyToEmailParams): Promise<ReplyToEmailResult>;
  removeFromSequence(params: RemoveFromSequenceParams): Promise<RemoveFromSequenceResult>;
}
