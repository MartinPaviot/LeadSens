import { composio } from '@/agents/_shared/composio'
import type { ModuleResult, AgentProfile } from '@/agents/_shared/types'
import type { TrendsData } from '../types'

interface KeywordDataResult {
  tasks?: Array<{
    result?: Array<{
      keyword?: string
      keyword_info?: {
        search_volume?: number
        competition?: number
        monthly_searches?: Array<{ year: number; month: number; search_volume: number }>
      }
    }>
  }>
}

interface SerpResult {
  organic_results?: Array<{ link?: string; title?: string }>
  related_searches?: Array<{ query?: string }>
}

interface GoogleTrendsResult {
  related_queries?: {
    rising?: Array<{ query: string; value?: number }>
    top?: Array<{ query: string; value?: number }>
  }
}

/**
 * Fetch Google Trends related queries via SerpAPI google_trends engine.
 */
async function fetchGoogleTrends(keyword: string): Promise<string[]> {
  const key = process.env.SERPAPI_KEY
  if (!key) return []

  try {
    const params = new URLSearchParams({
      api_key: key,
      q: keyword,
      engine: 'google_trends',
      data_type: 'RELATED_QUERIES',
    })
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as GoogleTrendsResult
    const rising = data.related_queries?.rising?.map((r) => r.query) ?? []
    const top = data.related_queries?.top?.map((r) => r.query) ?? []
    return [...rising, ...top].slice(0, 10)
  } catch {
    return []
  }
}

function deriveTrendDirection(
  monthly: Array<{ year: number; month: number; search_volume: number }> | undefined,
): 'up' | 'stable' | 'down' {
  if (!monthly || monthly.length < 2) return 'stable'
  const sorted = [...monthly].sort(
    (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month),
  )
  const recent = sorted.slice(-3)
  const older = sorted.slice(-6, -3)
  if (recent.length === 0 || older.length === 0) return 'stable'
  const recentAvg =
    recent.reduce((s, m) => s + (m.search_volume ?? 0), 0) / recent.length
  const olderAvg =
    older.reduce((s, m) => s + (m.search_volume ?? 0), 0) / older.length
  if (olderAvg === 0) return 'stable'
  const change = (recentAvg - olderAvg) / olderAvg
  if (change > 0.1) return 'up'
  if (change < -0.1) return 'down'
  return 'stable'
}

export async function fetchTrends(
  profile: AgentProfile,
): Promise<ModuleResult<TrendsData>> {
  try {
    const currentYear = new Date().getFullYear()
    const keywords = [
      profile.primary_keyword,
      profile.secondary_keyword,
      ...profile.competitors.slice(0, 2).map((c) => c.name),
    ]

    const [keywordRaw, serpRaw, googleTrendsRaw] = await Promise.allSettled([
      composio.getKeywords(keywords, profile.country),
      composio.searchSerp(
        `${profile.primary_keyword} tendances ${currentYear}`,
        10,
      ),
      fetchGoogleTrends(profile.primary_keyword),
    ])

    const kwData =
      keywordRaw.status === 'fulfilled'
        ? (keywordRaw.value as KeywordDataResult | null)
        : null

    const serpData =
      serpRaw.status === 'fulfilled'
        ? (serpRaw.value as SerpResult | null)
        : null

    if (!kwData && !serpData) {
      return { success: false, data: null, source: 'trends', degraded: true }
    }

    const results = kwData?.tasks?.[0]?.result ?? []

    const kwKeywords = results.map((r) => ({
      term: r.keyword ?? '',
      volume: r.keyword_info?.search_volume ?? 0,
      trend_direction: deriveTrendDirection(r.keyword_info?.monthly_searches),
    }))

    // Fallback: if no keyword data, derive from profile keywords
    const finalKeywords =
      kwKeywords.length > 0
        ? kwKeywords
        : keywords.map((k) => ({ term: k, volume: 0, trend_direction: 'stable' as const }))

    // Merge SERP related searches with Google Trends rising queries
    const serpQueries = (serpData?.related_searches ?? [])
      .map((r) => r.query ?? '')
      .filter(Boolean)

    const trendsQueries =
      googleTrendsRaw.status === 'fulfilled' ? googleTrendsRaw.value : []

    const risingQueries = [...new Set([...trendsQueries, ...serpQueries])]
      .slice(0, 12)

    const topPages = (serpData?.organic_results ?? [])
      .map((r) => r.link ?? '')
      .filter(Boolean)
      .slice(0, 5)

    return {
      success: true,
      data: { keywords: finalKeywords, rising_queries: risingQueries, top_pages: topPages },
      source: 'trends',
    }
  } catch (err) {
    return {
      success: false,
      data: null,
      source: 'trends',
      error: { code: 'FETCH_FAILED', message: String(err) },
    }
  }
}
