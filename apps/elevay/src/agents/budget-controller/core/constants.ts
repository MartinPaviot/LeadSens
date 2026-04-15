import type { HealthLevel } from "./types"

// ── Health Score Weights ────────────────────────────────

export const HEALTH_SCORE_WEIGHTS = {
  efficiency: 0.30,
  budgetCompliance: 0.25,
  goalAttainment: 0.25,
  cacControl: 0.15,
  stability: 0.05,
} as const

// ── Alert Levels ────────────────────────────────────────

export const ALERT_LEVELS: Record<HealthLevel, { min: number; max: number; label: string; color: string }> = {
  critical: { min: 0, max: 40, label: "CRITIQUE", color: "#ef4444" },
  attention: { min: 41, max: 65, label: "ATTENTION", color: "#f59e0b" },
  ok: { min: 66, max: 80, label: "CORRECT", color: "#17c3b2" },
  optimal: { min: 81, max: 100, label: "OPTIMAL", color: "#2c6bed" },
} as const

// ── Decision Tree Rules ─────────────────────────────────

export const DECISION_TREE_RULES = {
  /** ROI < minimum AND budget > 15% allocated → reduce 20-30% or stop */
  LOW_ROI_HIGH_SPEND: { roiThreshold: 1.0, budgetShareThreshold: 0.15, reduction: 0.25 },
  /** CAC rising N consecutive weeks → alert drift */
  CAC_DRIFT: { consecutiveWeeks: 3 },
  /** ROI > 150% target → scaling opportunity +15-25% */
  SCALING_OPPORTUNITY: { roiMultiple: 1.5, budgetIncrease: 0.20 },
  /** < 60% budget consumed at mid-period → check underperformance */
  UNDERSPEND: { consumptionThreshold: 0.60 },
  /** Spend > 110% allocated → overspend alert */
  OVERSPEND: { threshold: 1.10 },
  /** Revenue target at risk with < 8 weeks remaining */
  GOAL_AT_RISK: { weeksRemaining: 8 },
} as const

// ── Diminishing Returns Coefficient ─────────────────────

/** Applied to What If simulations — budget changes don't scale linearly */
export const DIMINISHING_RETURNS_COEFF = 0.85

// ── Agent Metadata ──────────────────────────────────────

export const BDG_AGENT_CODE = "BDG-32" as const
export const BDG_VERSION = "1.0" as const
