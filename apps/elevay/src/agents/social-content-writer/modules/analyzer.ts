import type { AnalyzerInsights } from "../core/types"
import { env } from "@/lib/env"
import { agentWarn } from "@/agents/_shared/agent-logger"

const AGENT = "SCW-16"

/**
 * Fetch trending search queries related to a topic via SerpAPI.
 */
async function fetchTrendingQueries(topic: string): Promise<string[]> {
  const key = env.SERPAPI_KEY
  if (!key) return []

  try {
    const params = new URLSearchParams({
      api_key: key,
      q: topic,
      engine: "google_trends",
      data_type: "RELATED_QUERIES",
    })
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return []

    const data = await res.json() as {
      related_queries?: {
        rising?: Array<{ query: string }>
        top?: Array<{ query: string }>
      }
    }
    const rising = data.related_queries?.rising?.map((r) => r.query) ?? []
    const top = data.related_queries?.top?.map((r) => r.query) ?? []
    return [...rising, ...top].slice(0, 10)
  } catch (err) {
    agentWarn(AGENT, "analyzer", "SerpAPI trends fetch failed", err instanceof Error ? err.message : err)
    return []
  }
}

/**
 * Extract popular hashtags from Google search suggestions.
 */
async function fetchHashtags(topic: string): Promise<string[]> {
  const key = env.SERPAPI_KEY
  if (!key) return []

  try {
    const params = new URLSearchParams({
      api_key: key,
      q: `${topic} hashtags`,
      engine: "google",
      num: "5",
    })
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return []

    const data = await res.json() as {
      related_searches?: Array<{ query: string }>
    }
    // Extract hashtag-like terms from related searches
    const related = data.related_searches?.map((r) => r.query) ?? []
    return related
      .flatMap((q) => q.match(/#\w+/g) ?? [])
      .filter((h, i, arr) => arr.indexOf(h) === i)
      .slice(0, 15)
  } catch (err) {
    agentWarn(AGENT, "analyzer", "SerpAPI hashtags fetch failed", err instanceof Error ? err.message : err)
    return []
  }
}

/**
 * Fetch competitor content hooks from SERP snippets.
 */
async function fetchCompetitorHooks(topic: string): Promise<string[]> {
  const key = env.SERPAPI_KEY
  if (!key) return []

  try {
    const params = new URLSearchParams({
      api_key: key,
      q: `${topic} social media tips`,
      engine: "google",
      num: "5",
    })
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return []

    const data = await res.json() as {
      organic_results?: Array<{ title?: string; snippet?: string }>
    }
    return (data.organic_results ?? [])
      .map((r) => r.title ?? r.snippet ?? "")
      .filter(Boolean)
      .slice(0, 5)
  } catch (err) {
    agentWarn(AGENT, "analyzer", "SerpAPI competitor hooks failed", err instanceof Error ? err.message : err)
    return []
  }
}

/**
 * Enrich a brief with trending data and competitor insights.
 * Uses SerpAPI (already configured in env) for real data.
 * Gracefully degrades to empty arrays if API key missing or calls fail.
 */
export async function enrich(
  topic: string,
  _language: string,
): Promise<AnalyzerInsights> {
  // Run all enrichment calls in parallel
  const [hashtags, trendingTopics, competitorHooks] = await Promise.all([
    fetchHashtags(topic),
    fetchTrendingQueries(topic),
    fetchCompetitorHooks(topic),
  ])

  return {
    hashtags,
    trendingTopics,
    competitorHooks,
    bestPerformingFormats: [], // Requires analytics integration (future)
  }
}
