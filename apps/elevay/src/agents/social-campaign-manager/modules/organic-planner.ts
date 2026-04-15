import { callLLM } from "@/agents/_shared/llm"
import type {
  CampaignBrief,
  OrganicCalendar,
  PlannedPost,
  Platform,
} from "../core/types"
import { ORGANIC_POSTS_PER_WEEK } from "../core/constants"
import {
  getOrganicCalendarPrompt,
  buildCalendarUserPrompt,
} from "../core/prompts"

// ── LLM Response Validation ────────────────────────────

interface CalendarLLMResponse {
  posts: Array<{
    platform: string
    date: string
    time: string
    content: string
    hashtags: string[]
    mediaType: string
    objective: string
    status?: string
  }>
  platformBreakdown: Record<string, number>
}

function isCalendarResponse(v: unknown): v is CalendarLLMResponse {
  if (!v || typeof v !== "object") return false
  const obj = v as Record<string, unknown>
  return Array.isArray(obj["posts"]) && typeof obj["platformBreakdown"] === "object"
}

// ── Calendar Generation ────────────────────────────────

/**
 * Generate an organic editorial calendar for the given month.
 * Only includes platforms that support organic posts (excludes Google).
 */
export async function generateCalendar(
  brief: CampaignBrief,
  month: string, // YYYY-MM format
  language: string = "en",
): Promise<OrganicCalendar> {
  const organicPlatforms = brief.platforms.filter(
    (p) => ORGANIC_POSTS_PER_WEEK[p] > 0,
  )

  if (organicPlatforms.length === 0) {
    return {
      month,
      posts: [],
      platformBreakdown: {} as Record<Platform, number>,
    }
  }

  const response = await callLLM({
    system: getOrganicCalendarPrompt(language),
    user: buildCalendarUserPrompt(
      month,
      organicPlatforms,
      brief.product,
      brief.audience,
      brief.vertical,
    ),
    maxTokens: 4096,
    temperature: 0.6,
  })

  if (!isCalendarResponse(response.parsed)) {
    return {
      month,
      posts: [],
      platformBreakdown: {} as Record<Platform, number>,
    }
  }

  const raw = response.parsed

  const posts: PlannedPost[] = raw.posts.map((p) => ({
    platform: p.platform as Platform,
    date: p.date,
    time: p.time,
    content: p.content,
    hashtags: p.hashtags,
    mediaType: p.mediaType as PlannedPost["mediaType"],
    objective: p.objective as PlannedPost["objective"],
    status: "planned",
  }))

  const platformBreakdown = {} as Record<Platform, number>
  for (const [key, value] of Object.entries(raw.platformBreakdown)) {
    platformBreakdown[key as Platform] = value
  }

  return { month, posts, platformBreakdown }
}
