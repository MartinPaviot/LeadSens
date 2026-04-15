// ── Platforms ────────────────────────────────────────────

export type SMIPlatform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "x"
  | "tiktok"
  | "reddit"

// ── Incoming Messages ───────────────────────────────────

export type MessageType = "dm" | "comment" | "mention" | "reply"

export interface MessageAuthor {
  id: string
  name: string
  handle: string
  followers?: number
  verified?: boolean
}

export interface IncomingMessage {
  id: string
  platform: SMIPlatform
  type: MessageType
  author: MessageAuthor
  content: string
  timestamp: string
  parentPostId?: string
  parentPostContent?: string
}

// ── Classification ──────────────────────────────────────

export type MessageCategory =
  | "lead"
  | "negative"
  | "toxic"
  | "support"
  | "product-question"
  | "partnership"
  | "influencer"
  | "positive"
  | "neutral"
  | "spam"

export type SentimentLevel = "positive" | "neutral" | "negative" | "urgent"

export interface Classification {
  category: MessageCategory
  confidence: number // 0-1
  sentiment: SentimentLevel
  sentimentScore: number // 0-10
  isInfluencer: boolean
  layer: 1 | 2 // which layer classified
}

// ── Escalation ──────────────────────────────────────────

export type EscalationLevel = "critical" | "attention" | "opportunity"

export interface Escalation {
  level: EscalationLevel
  message: IncomingMessage
  classification: Classification
  actionTaken: string
  draftResponse?: string
  notifiedVia: string
  timestamp: string
}

// ── Lead Qualification ──────────────────────────────────

export type CRMSyncStatus = "pending" | "synced" | "failed"

export interface LeadQualification {
  messageId: string
  score: number // 0-100
  budget?: string
  need?: string
  timeline?: string
  isDecisionMaker?: boolean
  crmSyncStatus: CRMSyncStatus
  crmContactId?: string
}

// ── FAQ ─────────────────────────────────────────────────

export interface FAQEntry {
  id: string
  question: string
  keywords: string[]
  answer: string
  platform?: string
  hitCount: number
}

// ── Configuration ───────────────────────────────────────

export type AutomationLevel = "full-auto" | "validation" | "off-hours"
export type CRMTool = "hubspot" | "salesforce" | "pipedrive"
export type HelpdeskTool = "zendesk" | "freshdesk"

export interface OffHoursSchedule {
  timezone: string
  workStart: string // HH:mm
  workEnd: string // HH:mm
  workDays: number[] // 0=Sunday, 1=Monday...
}

export interface InteractionConfig {
  platforms: SMIPlatform[]
  brandTone: {
    description: string
    examples: string[]
    forbiddenWords: string[]
  }
  automationLevel: AutomationLevel
  offHoursSchedule?: OffHoursSchedule
  spamDeletion: boolean
  escalationThresholds: {
    sentimentMin: number // below this = escalate
    influencerAudienceMin: number
    leadScoreMin: number
  }
  crmTool: CRMTool | null
  helpdeskTool: HelpdeskTool | null
  escalationChannel: "email" | "slack" | "sms"
}

// ── Processing Result ───────────────────────────────────

export interface ProcessingResult {
  message: IncomingMessage
  classification: Classification
  response?: string
  responseSent: boolean
  escalation?: Escalation
  leadQualification?: LeadQualification
  processedAt: string
}
