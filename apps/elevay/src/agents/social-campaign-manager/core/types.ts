// ── Platform & Vertical ────────────────────────────────

export type Platform = "google" | "meta" | "linkedin" | "x" | "tiktok"

export type Vertical = "ecommerce" | "b2b" | "saas" | "personal-branding"

export type AutonomyLevel = "full-auto" | "supervised" | "manual"

export type CampaignObjective =
  | "awareness"
  | "traffic"
  | "leads"
  | "conversions"
  | "app-installs"
  | "engagement"

export type CampaignStatus =
  | "draft"
  | "pending-review"
  | "active"
  | "paused"
  | "completed"

// ── Campaign Brief ─────────────────────────────────────

export interface BudgetConstraints {
  minDailySpend: number
  maxDailySpend: number
  testBudgetCap: number // Max % for A/B tests
}

export interface CampaignBrief {
  objective: CampaignObjective
  monthlyBudget: number
  platforms: Platform[]
  vertical: Vertical
  audience: string // Free-text audience description
  product: string // Product/service description
  kpis: string[] // e.g. ["CPA < 20", "ROAS > 3"]
  autonomyLevel: AutonomyLevel
  budgetConstraints: BudgetConstraints
}

// ── Budget Allocation ──────────────────────────────────

export interface BudgetSplit {
  cold: number // % for cold audiences
  retargeting: number // % for retargeting
  scaling: number // % for scaling winners
  tests: number // % for A/B testing
}

export interface PlatformBudget {
  platform: Platform
  amount: number
  percentage: number
}

export interface BudgetAllocation {
  split: BudgetSplit
  byPlatform: PlatformBudget[]
  totalMonthly: number
}

// ── Campaign Structure ─────────────────────────────────

export interface AudienceConfig {
  name: string
  targeting: string
  estimatedSize?: string
}

export interface CreativeConfig {
  headline: string
  body: string
  cta: string
  format: "image" | "video" | "carousel" | "text"
}

export interface KpiTarget {
  metric: string
  target: number
  unit: string // e.g. "EUR", "%", "x"
}

export interface CampaignStructure {
  platform: Platform
  name: string
  type: "cold" | "retargeting" | "scaling" | "test"
  budget: number
  audience: AudienceConfig
  creatives: CreativeConfig[]
  kpiTargets: KpiTarget[]
  status: CampaignStatus
}

// ── Organic Calendar ───────────────────────────────────

export interface PlannedPost {
  platform: Platform
  date: string // ISO 8601
  time: string // HH:mm
  content: string
  hashtags: string[]
  mediaType: "image" | "video" | "carousel" | "text" | "story"
  objective: CampaignObjective
  status: "planned" | "published" | "failed"
}

export interface OrganicCalendar {
  month: string // YYYY-MM
  posts: PlannedPost[]
  platformBreakdown: Record<Platform, number>
}

// ── Weekly Report ──────────────────────────────────────

export interface PlatformMetrics {
  platform: Platform
  spend: number
  impressions: number
  clicks: number
  conversions: number
  ctr: number
  cpc: number
  cpa: number
  roas: number
}

export interface ReportAction {
  type: "pause" | "scale" | "adjust-budget" | "new-creative" | "new-audience"
  campaign: string
  reason: string
  impact: string
}

export interface ReportRecommendation {
  priority: "high" | "medium" | "low"
  action: string
  expectedImpact: string
}

export interface WeeklyReport {
  week: string // ISO week: YYYY-Www
  platforms: PlatformMetrics[]
  actionsExecuted: ReportAction[]
  recommendations: ReportRecommendation[]
  totalSpend: number
  totalConversions: number
  overallRoas: number
}

// ── Strategy Output ────────────────────────────────────

export interface StrategyOutput {
  brief: CampaignBrief
  budgetAllocation: BudgetAllocation
  campaigns: CampaignStructure[]
  calendar: OrganicCalendar | null
  generatedAt: string // ISO 8601
}
