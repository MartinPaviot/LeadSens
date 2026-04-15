import type { MessageCategory } from "./types"

// ── Category Priorities (lower = higher priority) ───────

export const CATEGORY_PRIORITIES: Record<MessageCategory, number> = {
  toxic: 1,
  negative: 2,
  lead: 3,
  support: 4,
  influencer: 5,
  partnership: 6,
  "product-question": 7,
  positive: 8,
  neutral: 9,
  spam: 10,
} as const

// ── Sentiment Thresholds ────────────────────────────────

export const SENTIMENT_THRESHOLDS = {
  CRITICAL: 2, // score 0-2 = critical
  NEGATIVE: 4, // score 3-4 = negative
  NEUTRAL: 6, // score 5-6 = neutral
  POSITIVE: 10, // score 7-10 = positive
} as const

// ── Default Escalation Thresholds ───────────────────────

export const DEFAULT_ESCALATION_THRESHOLDS = {
  sentimentMin: 3,
  influencerAudienceMin: 10000,
  leadScoreMin: 70,
} as const

// ── Spam Patterns ───────────────────────────────────────

export const SPAM_PATTERNS = [
  /https?:\/\/\S+\.(xyz|tk|ml|ga|cf)\b/i,
  /\b(free money|click here|earn \$|bitcoin|crypto giveaway)\b/i,
  /(.)\1{5,}/, // repeated characters
  /^.{1,3}$/, // 1-3 char messages
] as const

// ── Agent Metadata ──────────────────────────────────────

export const SMI_AGENT_CODE = "SMI-20" as const
export const SMI_VERSION = "1.0" as const
