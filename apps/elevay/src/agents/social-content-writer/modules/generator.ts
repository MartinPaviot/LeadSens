import { callLLM } from "@/agents/_shared/llm"
import { sanitize } from "@/agents/_shared/utils"
import type {
  ContentBrief,
  BrandVoiceProfile,
  GeneratedVariation,
  ThreadTweet,
  GenerationOutput,
  Platform,
  AnalyzerInsights,
} from "../core/types"
import { resolveFormat, PLATFORM_CONFIGS } from "../core/constants"
import {
  getCaptionSystemPrompt,
  getLongFormSystemPrompt,
  getThreadSystemPrompt,
  getRedditSystemPrompt,
} from "../core/prompts"
import { enrich } from "./analyzer"

// ── LLM Response Types ──────────────────────────────────

interface CaptionLLMVariation {
  content: string
  hashtags: string[]
  cta: string
  mediaSuggestions?: string[]
}

interface ThreadLLMVariation {
  tweets: Array<{ index: number; content: string; hook?: string }>
  hashtags: string[]
  cta: string
}

function isCaptionResponse(
  v: unknown,
): v is { variations: CaptionLLMVariation[] } {
  if (!v || typeof v !== "object") return false
  const obj = v as Record<string, unknown>
  return Array.isArray(obj["variations"])
}

function isThreadResponse(
  v: unknown,
): v is { variations: ThreadLLMVariation[] } {
  if (!v || typeof v !== "object") return false
  const obj = v as Record<string, unknown>
  return (
    Array.isArray(obj["variations"]) &&
    obj["variations"].length > 0 &&
    Array.isArray(
      (obj["variations"] as Array<Record<string, unknown>>)[0]?.["tweets"],
    )
  )
}

// ── Generator ───────────────────────────────────────────

async function generateForPlatform(
  platform: Platform,
  brief: ContentBrief,
  voice: BrandVoiceProfile,
  insights: AnalyzerInsights,
): Promise<{
  variations: GeneratedVariation[]
  threads?: Record<string, ThreadTweet[]>
}> {
  const format = resolveFormat(brief.format, platform)
  const cfg = PLATFORM_CONFIGS[platform]
  const language = "en" // V1: default to English, will use workspace language later

  const userPrompt = buildUserPrompt(brief, insights, platform)

  if (format === "thread") {
    return generateThread(brief, voice, insights, language)
  }

  if (format === "reddit-ama") {
    return generateReddit(brief, voice, language)
  }

  // Caption or long-form
  const systemPrompt =
    format === "long-form"
      ? getLongFormSystemPrompt(voice, platform, language)
      : getCaptionSystemPrompt(voice, platform, language)

  const response = await callLLM({
    system: systemPrompt,
    user: userPrompt,
    maxTokens: format === "long-form" ? 4096 : 2048,
    temperature: 0.7,
  })

  const variations: GeneratedVariation[] = []

  if (isCaptionResponse(response.parsed)) {
    for (let i = 0; i < response.parsed.variations.length; i++) {
      const v = response.parsed.variations[i]
      variations.push({
        platform,
        format,
        variationIndex: i,
        content: v.content,
        hashtags: v.hashtags,
        cta: v.cta,
        characterCount: v.content.length,
        characterLimit: cfg.characterLimit,
        mediaSuggestions: v.mediaSuggestions,
      })
    }
  }

  return { variations }
}

async function generateThread(
  brief: ContentBrief,
  voice: BrandVoiceProfile,
  insights: AnalyzerInsights,
  language: string,
): Promise<{
  variations: GeneratedVariation[]
  threads: Record<string, ThreadTweet[]>
}> {
  const systemPrompt = getThreadSystemPrompt(voice, language)
  const userPrompt = buildUserPrompt(brief, insights, "x")

  const response = await callLLM({
    system: systemPrompt,
    user: userPrompt,
    maxTokens: 3000,
    temperature: 0.7,
  })

  const variations: GeneratedVariation[] = []
  const threads: Record<string, ThreadTweet[]> = {}

  if (isThreadResponse(response.parsed)) {
    for (let i = 0; i < response.parsed.variations.length; i++) {
      const v = response.parsed.variations[i]
      const threadId = `thread-${i}`
      const fullContent = v.tweets.map((t) => t.content).join("\n\n")

      variations.push({
        platform: "x",
        format: "thread",
        variationIndex: i,
        content: fullContent,
        hashtags: v.hashtags,
        cta: v.cta,
        characterCount: fullContent.length,
        characterLimit: 280 * v.tweets.length,
      })

      threads[threadId] = v.tweets.map((t) => ({
        index: t.index,
        content: t.content,
        characterCount: t.content.length,
        hook: t.hook,
      }))
    }
  }

  return { variations, threads }
}

async function generateReddit(
  brief: ContentBrief,
  voice: BrandVoiceProfile,
  language: string,
): Promise<{ variations: GeneratedVariation[] }> {
  const systemPrompt = getRedditSystemPrompt(voice, language)
  const userPrompt = `Topic: ${brief.sourceContent}\nObjective: ${brief.objective}\n${brief.cta ? `CTA: ${brief.cta}` : ""}`

  const response = await callLLM({
    system: systemPrompt,
    user: userPrompt,
    maxTokens: 4096,
    temperature: 0.7,
  })

  const variations: GeneratedVariation[] = []

  if (isCaptionResponse(response.parsed)) {
    for (let i = 0; i < response.parsed.variations.length; i++) {
      const v = response.parsed.variations[i]
      variations.push({
        platform: "reddit",
        format: "reddit-ama",
        variationIndex: i,
        content: v.content,
        hashtags: [],
        cta: v.cta,
        characterCount: v.content.length,
        characterLimit: 40000,
      })
    }
  }

  return { variations }
}

function buildUserPrompt(
  brief: ContentBrief,
  insights: AnalyzerInsights,
  platform: Platform,
): string {
  const lines = [
    `Topic/Content: ${sanitize(brief.sourceContent)}`,
    `Objective: ${brief.objective}`,
    `Number of variations: ${brief.variationsCount}`,
  ]

  if (brief.tone) lines.push(`Tone override: ${sanitize(brief.tone)}`)
  if (brief.cta) lines.push(`Requested CTA: ${sanitize(brief.cta)}`)
  if (brief.hashtags?.length) {
    lines.push(`Client hashtags to include: ${brief.hashtags.join(", ")}`)
  }
  if (brief.mentions?.length) {
    lines.push(`Mentions to include: ${brief.mentions.join(", ")}`)
  }
  if (insights.hashtags.length > 0) {
    lines.push(
      `Trending hashtags (BuzzSumo): ${insights.hashtags.slice(0, 10).join(", ")}`,
    )
  }
  if (insights.competitorHooks.length > 0) {
    lines.push(
      `Competitor hooks for inspiration: ${insights.competitorHooks.slice(0, 3).join(" | ")}`,
    )
  }

  return lines.join("\n")
}

// ── Main Generate Function ──────────────────────────────

export async function generate(
  brief: ContentBrief,
  voice: BrandVoiceProfile,
): Promise<GenerationOutput> {
  const insights = await enrich(brief.sourceContent, "en")

  const allVariations: GeneratedVariation[] = []
  const allThreads: Record<string, ThreadTweet[]> = {}

  for (const platform of brief.platforms) {
    const result = await generateForPlatform(platform, brief, voice, insights)
    allVariations.push(...result.variations)
    if (result.threads) {
      Object.assign(allThreads, result.threads)
    }
  }

  return {
    brief,
    variations: allVariations,
    threads: Object.keys(allThreads).length > 0 ? allThreads : undefined,
    hashtagsUsed: [
      ...new Set(allVariations.flatMap((v) => v.hashtags)),
    ],
    benchmarkInsights: insights.trendingTopics.length > 0
      ? `Trending: ${insights.trendingTopics.join(", ")}`
      : undefined,
    generatedAt: new Date().toISOString(),
  }
}
