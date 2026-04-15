import { z } from "zod"
import type { ContentBrief, ContentFormat, Platform } from "../core/types"
import { resolveFormat } from "../core/constants"

// ── Zod Schema ──────────────────────────────────────────

export const ContentBriefSchema = z.object({
  format: z.enum([
    "caption",
    "long-form",
    "thread",
    "reddit-ama",
    "article",
  ]),
  platforms: z
    .array(
      z.enum([
        "instagram",
        "facebook",
        "tiktok",
        "linkedin",
        "pinterest",
        "threads",
        "youtube",
        "x",
        "reddit",
      ]),
    )
    .min(1),
  objective: z.enum([
    "engagement",
    "awareness",
    "traffic",
    "conversion",
    "thought-leadership",
    "recruitment",
    "activation",
  ]),
  sourceContent: z.string().min(1),
  tone: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  mentions: z.array(z.string()).optional(),
  cta: z.string().optional(),
  crossPlatform: z.boolean().default(false),
  variationsCount: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
})

// ── Format Detection ────────────────────────────────────

const FORMAT_KEYWORDS: Record<ContentFormat, string[]> = {
  caption: ["caption", "short post", "description", "post court"],
  "long-form": [
    "long-form",
    "long post",
    "article",
    "post long",
    "long format",
  ],
  thread: ["thread", "fil", "tweet storm"],
  "reddit-ama": ["reddit", "ama", "discussion"],
  article: ["article", "linkedin pulse", "pulse"],
}

const PLATFORM_KEYWORDS: Record<Platform, string[]> = {
  instagram: ["instagram", "ig", "insta"],
  facebook: ["facebook", "fb"],
  tiktok: ["tiktok", "tik tok"],
  linkedin: ["linkedin", "li"],
  pinterest: ["pinterest"],
  threads: ["threads"],
  youtube: ["youtube", "yt"],
  x: ["twitter", "x", "tweet"],
  reddit: ["reddit", "subreddit", "ama"],
}

export function detectFormat(message: string): ContentFormat | null {
  const lower = message.toLowerCase()
  for (const [format, keywords] of Object.entries(FORMAT_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return format as ContentFormat
    }
  }
  return null
}

export function detectPlatforms(message: string): Platform[] {
  const lower = message.toLowerCase()
  const detected: Platform[] = []
  for (const [platform, keywords] of Object.entries(PLATFORM_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      detected.push(platform as Platform)
    }
  }
  return detected
}

export function detectCrossPlatform(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("cross-platform") ||
    lower.includes("cross platform") ||
    lower.includes("toutes les plateformes") ||
    lower.includes("all platforms") ||
    lower.includes("multi-platform")
  )
}

// ── Resolve formats per platform ────────────────────────

export function resolveFormatsForBrief(brief: ContentBrief): ContentBrief {
  return {
    ...brief,
    // Format resolution happens at generation time per-platform via resolveFormat()
  }
}
