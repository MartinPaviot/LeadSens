import type { Platform, ContentFormat } from "./types"

// ── Platform Configurations ─────────────────────────────

export interface PlatformConfig {
  name: string
  characterLimit: number
  defaultHashtagCount: number
  dominantTone: string
  priorityCta: string
  supportedFormats: ContentFormat[]
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  instagram: {
    name: "Instagram",
    characterLimit: 2200,
    defaultHashtagCount: 10,
    dominantTone: "Inspirational, storytelling",
    priorityCta: "Link in bio / Swipe up / Tag",
    supportedFormats: ["caption"],
  },
  facebook: {
    name: "Facebook",
    characterLimit: 63206,
    defaultHashtagCount: 3,
    dominantTone: "Friendly, informative",
    priorityCta: "Comment / Share / Link",
    supportedFormats: ["caption", "long-form"],
  },
  tiktok: {
    name: "TikTok",
    characterLimit: 2200,
    defaultHashtagCount: 5,
    dominantTone: "Offbeat, authentic, viral",
    priorityCta: "Duet / Comment / Link in bio",
    supportedFormats: ["caption"],
  },
  linkedin: {
    name: "LinkedIn",
    characterLimit: 3000,
    defaultHashtagCount: 4,
    dominantTone: "Professional, authority",
    priorityCta: "Comment / Share",
    supportedFormats: ["caption", "long-form", "article"],
  },
  pinterest: {
    name: "Pinterest",
    characterLimit: 500,
    defaultHashtagCount: 3,
    dominantTone: "Educational, aspirational",
    priorityCta: "Pinned link / Visit site",
    supportedFormats: ["caption"],
  },
  threads: {
    name: "Threads",
    characterLimit: 500,
    defaultHashtagCount: 2,
    dominantTone: "Conversational, opinionated",
    priorityCta: "Reply / Repost",
    supportedFormats: ["caption", "long-form"],
  },
  youtube: {
    name: "YouTube",
    characterLimit: 5000,
    defaultHashtagCount: 6,
    dominantTone: "Educational, SEO, narrative",
    priorityCta: "Subscribe / Link / Comment",
    supportedFormats: ["caption"],
  },
  x: {
    name: "X (Twitter)",
    characterLimit: 280,
    defaultHashtagCount: 1,
    dominantTone: "Direct, punchy, opinionated",
    priorityCta: "Retweet / Reply / Link",
    supportedFormats: ["caption", "thread"],
  },
  reddit: {
    name: "Reddit",
    characterLimit: 40000,
    defaultHashtagCount: 0,
    dominantTone: "Honest, direct, community-first",
    priorityCta: "Upvote / Comment / Discussion",
    supportedFormats: ["reddit-ama"],
  },
} as const

// ── Format Compatibility Matrix ─────────────────────────

/** Resolve the best content format for a platform given the requested format. */
export function resolveFormat(
  requestedFormat: ContentFormat,
  platform: Platform,
): ContentFormat {
  const supported = PLATFORM_CONFIGS[platform].supportedFormats
  if (supported.includes(requestedFormat)) return requestedFormat

  // Special routing rules
  if (platform === "x" && requestedFormat === "long-form") return "thread"
  if (platform === "x" && requestedFormat === "article") return "thread"

  // Default to first supported format
  return supported[0]
}

// ── Thread Constraints ──────────────────────────────────

export const THREAD_CONFIG = {
  minTweets: 3,
  maxTweets: 10,
  tweetCharLimit: 280,
} as const

// ── Cache TTLs ──────────────────────────────────────────

export const CACHE_TTL = {
  HASHTAGS: 7 * 24 * 60 * 60, // 7 days in seconds
  TRENDS: 24 * 60 * 60, // 1 day in seconds
  BRAND_VOICE: 30 * 24 * 60 * 60, // 30 days in seconds
} as const

// ── Agent Metadata ──────────────────────────────────────

export const SCW_AGENT_CODE = "SCW-16" as const
export const SCW_VERSION = "1.0" as const
