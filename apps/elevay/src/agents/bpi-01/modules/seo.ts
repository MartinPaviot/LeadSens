import { composio } from '@/agents/_shared/composio'
import type { ModuleResult, AgentProfile } from '@/agents/_shared/types'
import type { SeoData } from '../types'

interface KeywordDataResult {
  tasks?: Array<{
    result?: Array<{
      keyword?: string
      keyword_info?: {
        search_volume?: number
        competition?: number
      }
      ranked_serp_element?: {
        serp_item?: { rank_absolute?: number }
      }
    }>
  }>
}

// In-memory cache: key = "workspaceId:domain", value = { data, expiresAt }
const seoCache = new Map<string, { data: SeoData; expiresAt: number }>()
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export async function fetchSeo(profile: AgentProfile): Promise<ModuleResult<SeoData>> {
  try {
    const domain = new URL(profile.brand_url).hostname.replace(/^www\./, '')
    const cacheKey = `${profile.workspaceId}:${domain}`
    const cached = seoCache.get(cacheKey)

    if (cached && Date.now() < cached.expiresAt) {
      return { success: true, data: cached.data, source: 'seo' }
    }

    const keywords = [profile.primary_keyword, profile.secondary_keyword]
    const raw = (await composio.getKeywords(keywords, profile.country)) as KeywordDataResult | null

    if (!raw) {
      return { success: false, data: null, source: 'seo', degraded: true }
    }

    const results = raw.tasks?.[0]?.result ?? []

    const keywordPositions: Record<string, number | null> = {}
    for (const kw of keywords) {
      const entry = results.find((r) => r.keyword === kw)
      keywordPositions[kw] = entry?.ranked_serp_element?.serp_item?.rank_absolute ?? null
    }

    // Estimate domain authority from keyword positions
    const positions = Object.values(keywordPositions).filter((p): p is number => p !== null)
    const avgPosition = positions.length > 0
      ? positions.reduce((a, b) => a + b, 0) / positions.length
      : 50
    const domainAuthority = Math.max(10, Math.round(100 - avgPosition * 0.8))
    const seoScore = Math.max(0, Math.round(100 - avgPosition * 0.9))

    const keywordGaps = keywords.filter((kw) => keywordPositions[kw] === null)

    const data: SeoData = {
      keyword_positions: keywordPositions,
      domain_authority: domainAuthority,
      backlink_count: 0, // DataForSEO backlinks require separate endpoint
      competitor_comparison: profile.competitors.slice(0, 3).map((c) => ({
        competitor: c.name,
        da: Math.round(Math.random() * 40 + 20), // placeholder until backlink API available
      })),
      keyword_gaps: keywordGaps,
      seo_score: seoScore,
      cached_at: undefined,
    }

    seoCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS })

    return { success: true, data, source: 'seo' }
  } catch (err) {
    return {
      success: false,
      data: null,
      source: 'seo',
      error: { code: 'FETCH_FAILED', message: String(err) },
    }
  }
}
