// ── Budget Configuration ────────────────────────────────

export interface ChannelBudget {
  channel: string // 'google-ads', 'meta-ads', 'seo', 'email', etc.
  annualBudget: number
  monthlyBudget: number
}

export interface BudgetConfig {
  annualBudget: number
  channels: ChannelBudget[]
  objectives: {
    annualRevenue: number
    quarterlyRevenue: number[]
    monthlyLeads: number
  }
  kpiTargets: {
    cplTarget: number
    cacTarget: number
    roiMinimum: number
  }
  alertThresholds: {
    overSpendPercent: number // e.g. 15 for 15%
    cacDeviationWeeks: number // consecutive weeks before alert
  }
  reportFrequency: "weekly" | "monthly"
  fiscalYearStart: number // month (1-12)
  escalationChannel: "email" | "slack" | "sms"
}

// ── Channel Metrics ─────────────────────────────────────

export type ChannelStatus = "critical" | "attention" | "ok" | "optimal"

export interface ChannelMetrics {
  channel: string
  period: string // 'week-2024-W48' or 'month-2024-12'
  spend: number
  budgetAllocated: number
  clicks: number
  conversions: number
  leads: number
  revenue: number
  cpl: number
  cac: number
  roi: number
  roas: number
  status: ChannelStatus
}

// ── Health Score ─────────────────────────────────────────

export type HealthLevel = "critical" | "attention" | "ok" | "optimal"
export type HealthTrend = "improving" | "stable" | "declining"

export interface HealthScoreComponents {
  efficiency: number
  budgetCompliance: number
  goalAttainment: number
  cacControl: number
  stability: number
}

export interface HealthScore {
  total: number // 0-100
  level: HealthLevel
  components: HealthScoreComponents
  trend: HealthTrend
  calculatedAt: string
}

// ── Alerts ──────────────────────────────────────────────

export type AlertLevel = "critical" | "attention" | "opportunity"
export type AlertType =
  | "overspend"
  | "underperformance"
  | "cac-drift"
  | "scaling-opportunity"
  | "goal-at-risk"
  | "underspend"

export interface Alert {
  id: string
  level: AlertLevel
  channel: string
  type: AlertType
  message: string
  impact: string
  recommendation: string
  metrics: Record<string, number>
  createdAt: string
  acknowledged: boolean
}

// ── What If ─────────────────────────────────────────────

export interface ChannelAdjustment {
  channel: string
  changePercent: number // e.g. -30 for 30% reduction
}

export interface WhatIfProjectedImpact {
  leadsChange: number
  cacChange: number
  revenueChange: number
  newHealthScore: number
  budgetCompliance: boolean
}

export interface WhatIfScenario {
  description: string
  adjustments: ChannelAdjustment[]
  projectedImpact: WhatIfProjectedImpact
}

// ── Projection ──────────────────────────────────────────

export interface ScenarioProjection {
  spend: number
  revenue: number
  healthScore: number
}

export interface AnnualProjection {
  currentSpend: number
  projectedSpend: number
  budgetAllocated: number
  variance: number
  revenueAchieved: number
  revenueTarget: number
  scenarios: {
    optimistic: ScenarioProjection
    nominal: ScenarioProjection
    pessimistic: ScenarioProjection
  }
}

// ── Dashboard ───────────────────────────────────────────

export interface BudgetDashboardData {
  healthScore: HealthScore
  channelMetrics: ChannelMetrics[]
  activeAlerts: Alert[]
  lastProjection: AnnualProjection | null
  lastSyncAt: string | null
}
