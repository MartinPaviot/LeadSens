// ── SMS Constraints ─────────────────────────────────────

export const SMS_CHAR_LIMIT = 160

// ── A/B Testing Defaults ────────────────────────────────

export const DEFAULT_AB_SAMPLE = 20 // % of list
export const DEFAULT_AB_DELAY = 4 // hours before decision
export const MIN_AB_SAMPLE_SIZE = 100 // minimum contacts for A/B

// ── Resend Defaults ─────────────────────────────────────

export const DEFAULT_RESEND_DELAY = 48 // hours
export const MAX_RESENDS = 1
export const RESEND_WINDOW_HOURS = 2 // send within 2h of approval

// ── Timing Defaults ─────────────────────────────────────

export const TIMING_DEFAULTS = {
  bestDays: ["Tuesday", "Wednesday", "Thursday"],
  bestHours: ["09:00", "10:00", "14:00"],
  avoidWeekends: true,
  avoidHolidays: true,
} as const

// ── Frequency Caps ──────────────────────────────────────

export const DEFAULT_MAX_SENDS_PER_WEEK = 3
export const MIN_HOURS_BETWEEN_SENDS = 24

// ── Benchmarks ──────────────────────────────────────────

export const INDUSTRY_BENCHMARKS = {
  saas: { openRate: 0.22, clickRate: 0.035 },
  ecommerce: { openRate: 0.18, clickRate: 0.025 },
  services: { openRate: 0.20, clickRate: 0.030 },
  default: { openRate: 0.20, clickRate: 0.030 },
} as const

// ── Agent Metadata ──────────────────────────────────────

export const CRM_AGENT_CODE = "CRM-27" as const
export const CRM_VERSION = "1.0" as const
