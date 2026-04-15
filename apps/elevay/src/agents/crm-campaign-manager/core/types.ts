// ── Campaign Brief ──────────────────────────────────────

export type CampaignObjective =
  | "sale"
  | "retention"
  | "reactivation"
  | "activation"
  | "event"

export type CampaignSegment =
  | "all"
  | "new"
  | "inactive"
  | "vip"
  | "buyers"

export type CampaignChannel = "email" | "sms" | "both"

export type CRMPlatform = "hubspot" | "klaviyo" | "brevo"
export type SMSPlatform = "twilio"

export type CampaignTone =
  | "promotional"
  | "informational"
  | "urgency"
  | "storytelling"
  | "minimal"

export interface CRMCampaignBrief {
  objective: CampaignObjective
  segment: CampaignSegment | string // string for custom segment IDs
  channel: CampaignChannel
  platform: CRMPlatform
  preferredDate?: string // ISO date
  preferredTime?: string // HH:mm
  tone: CampaignTone
  offerUrl?: string
  promoCode?: string
  smsBudget?: number
  abConfig?: ABConfig
  resendConfig?: ResendConfig
}

// ── A/B Testing ─────────────────────────────────────────

export type ABVariable =
  | "subject"
  | "cta"
  | "content"
  | "image"
  | "timing"
  | "segment"

export type ABWinCriteria = "open_rate" | "click_rate" | "conversion"

export interface ABConfig {
  enabled: boolean
  variable: ABVariable
  sampleSize: number // % of list
  winCriteria: ABWinCriteria
  decisionDelay: number // hours
}

// ── Resend Config ───────────────────────────────────────

export type ResendSegment = "non-openers" | "non-openers-and-non-clickers"

export interface ResendConfig {
  enabled: boolean
  delay: number // hours after initial send (default 48)
  segment: ResendSegment
  maxResends: number // default 1
  autoApprove: boolean // send without validation or propose first
}

// ── Drafts ──────────────────────────────────────────────

export interface EmailCTA {
  text: string
  url: string
}

export interface EmailDraft {
  subject: string
  preHeader: string
  bodyHtml: string
  cta: EmailCTA
  variantB?: {
    subject?: string
    cta?: EmailCTA
    bodyHtml?: string
  }
}

export interface SMSDraft {
  message: string
  characterCount: number
  trackedLink: string
  variantB?: { message: string }
}

// ── Reports ─────────────────────────────────────────────

export interface CampaignMetrics {
  openRate: number
  clickRate: number
  conversions: number
  revenue: number
  unsubscribes: number
  bounceRate: number
}

export interface ABResult {
  winner: "A" | "B"
  variantAMetrics: Record<string, number>
  variantBMetrics: Record<string, number>
  justification: string
}

export interface ResendProposal {
  segment: string
  count: number
  newSubject: string
}

export interface CampaignReport {
  campaignId: string
  metrics: CampaignMetrics
  benchmark: {
    openRate: number
    clickRate: number
  }
  abResult?: ABResult
  recommendations: string[]
  resendProposal?: ResendProposal
}

// ── Configuration ───────────────────────────────────────

export interface SegmentInfo {
  id: string
  name: string
  count: number
}

export interface TimingSlot {
  day: string
  hour: string
  openRate: number
}

export interface CRMConfig {
  platform: CRMPlatform
  smsPlatform?: SMSPlatform
  maxSendsPerContactPerWeek: number
  defaultResend: boolean
  alertThreshold?: number // open rate minimum before alert
  segments: SegmentInfo[]
  historicalOpenRate: number
  bestTimings: TimingSlot[]
}

// ── Platform Adapter Interface ──────────────────────────

export interface PlatformAdapter {
  scheduleCampaign(params: {
    draft: EmailDraft | SMSDraft
    segment: string
    scheduledAt: string
    abConfig?: ABConfig
  }): Promise<{ campaignId: string; scheduledAt: string }>

  cancelCampaign(campaignId: string): Promise<{ success: boolean }>

  getCampaignMetrics(campaignId: string): Promise<CampaignMetrics>

  getSegments(): Promise<SegmentInfo[]>

  getHistoricalOpenRate(days: number): Promise<number>
}
