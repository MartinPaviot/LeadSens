import type { Vertical, Platform, BudgetSplit } from "./types"

// ── Agent Metadata ─────────────────────────────────────

export const SMC_AGENT_CODE = "SMC-19" as const
export const SMC_VERSION = "1.0" as const

// ── Vertical KPI Configs ───────────────────────────────

export interface VerticalConfig {
  label: string
  primaryKpis: string[]
  secondaryKpis: string[]
  typicalCpa: { min: number; max: number } // EUR
  typicalRoas: { min: number; max: number }
}

export const VERTICAL_CONFIGS: Record<Vertical, VerticalConfig> = {
  ecommerce: {
    label: "E-commerce",
    primaryKpis: ["ROAS", "CPA", "Revenue"],
    secondaryKpis: ["CTR", "AOV", "Cart Abandonment Rate"],
    typicalCpa: { min: 8, max: 35 },
    typicalRoas: { min: 2, max: 8 },
  },
  b2b: {
    label: "B2B",
    primaryKpis: ["CPL", "MQL", "SQL"],
    secondaryKpis: ["CTR", "Demo Bookings", "Pipeline Value"],
    typicalCpa: { min: 30, max: 150 },
    typicalRoas: { min: 1.5, max: 5 },
  },
  saas: {
    label: "SaaS",
    primaryKpis: ["CAC", "Trial Signups", "Free-to-Paid"],
    secondaryKpis: ["CTR", "Activation Rate", "LTV/CAC"],
    typicalCpa: { min: 15, max: 80 },
    typicalRoas: { min: 2, max: 10 },
  },
  "personal-branding": {
    label: "Personal Branding",
    primaryKpis: ["Engagement Rate", "Follower Growth", "Reach"],
    secondaryKpis: ["Profile Visits", "DM Requests", "Share Rate"],
    typicalCpa: { min: 1, max: 10 },
    typicalRoas: { min: 1, max: 3 },
  },
}

// ── Budget Defaults ────────────────────────────────────

export const BUDGET_DEFAULTS: BudgetSplit = {
  cold: 40,
  retargeting: 25,
  scaling: 25,
  tests: 10,
}

// ── Platform Metadata ──────────────────────────────────

export interface PlatformMeta {
  label: string
  minDailyBudget: number // EUR
  bestFor: string[]
  adFormats: string[]
}

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  google: {
    label: "Google Ads",
    minDailyBudget: 5,
    bestFor: ["search intent", "conversions", "retargeting"],
    adFormats: ["search", "display", "shopping", "video", "performance-max"],
  },
  meta: {
    label: "Meta Ads",
    minDailyBudget: 5,
    bestFor: ["awareness", "engagement", "retargeting", "lookalike"],
    adFormats: ["image", "video", "carousel", "collection", "stories"],
  },
  linkedin: {
    label: "LinkedIn Ads",
    minDailyBudget: 10,
    bestFor: ["B2B leads", "thought leadership", "recruitment"],
    adFormats: ["sponsored-content", "message-ads", "text-ads", "document-ads"],
  },
  x: {
    label: "X Ads",
    minDailyBudget: 5,
    bestFor: ["engagement", "awareness", "trending topics"],
    adFormats: ["promoted-tweets", "video-ads", "carousel", "amplify"],
  },
  tiktok: {
    label: "TikTok Ads",
    minDailyBudget: 20,
    bestFor: ["awareness", "engagement", "Gen Z/Millennial reach"],
    adFormats: ["in-feed", "top-view", "branded-hashtag", "spark-ads"],
  },
}

// ── KPI Thresholds ─────────────────────────────────────

export interface KpiThreshold {
  metric: string
  warningBelow: number
  criticalBelow: number
  unit: string
}

export const KPI_THRESHOLDS: KpiThreshold[] = [
  { metric: "CTR", warningBelow: 1.0, criticalBelow: 0.5, unit: "%" },
  { metric: "CPC", warningBelow: 3.0, criticalBelow: 5.0, unit: "EUR" },
  { metric: "CPA", warningBelow: 50, criticalBelow: 100, unit: "EUR" },
  { metric: "ROAS", warningBelow: 2.0, criticalBelow: 1.0, unit: "x" },
  { metric: "Conversion Rate", warningBelow: 2.0, criticalBelow: 1.0, unit: "%" },
]

// ── Cadence ────────────────────────────────────────────

export const ORGANIC_POSTS_PER_WEEK: Record<Platform, number> = {
  google: 0, // No organic for Google Ads
  meta: 4,
  linkedin: 3,
  x: 7,
  tiktok: 5,
}
