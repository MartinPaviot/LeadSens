import { composio } from '@/agents/_shared/composio'
import type { ModuleResult } from '@/agents/_shared/types'
import type { AgentProfile } from '@/agents/_shared/types'
import type { SerpData } from '../types'

interface SerpResult {
  organic_results?: Array<{
    position?: number
    link?: string
    snippet?: string
  }>
}

function extractVisibilityScore(position: number | null): number {
  if (position === null) return 0
  if (position === 1) return 100
  if (position <= 3) return 85
  if (position <= 5) return 70
  if (position <= 10) return 50
  return 20
}

export async function fetchSerp(profile: AgentProfile): Promise<ModuleResult<SerpData>> {
  try {
    const queries = [
      profile.brand_name,
      `${profile.brand_name} ${profile.primary_keyword}`,
      `avis ${profile.brand_name}`,
      profile.competitors[0]?.name ?? profile.brand_name,
      profile.competitors[1]?.name ?? profile.brand_name,
    ]

    const results = await Promise.allSettled(
      queries.map((q) => composio.searchSerp(q, 10)),
    )

    const brandResult = results[0]
    const raw = brandResult?.status === 'fulfilled' ? (brandResult.value as SerpResult | null) : null

    if (!raw) {
      return { success: false, data: null, source: 'serp', degraded: true }
    }

    const organicResults = raw.organic_results ?? []
    const brandUrl = new URL(profile.brand_url).hostname.replace(/^www\./, '')

    // Find official site position
    const officialEntry = organicResults.find((r) =>
      r.link?.toLowerCase().includes(brandUrl),
    )
    const officialSitePosition = officialEntry?.position ?? null

    // Negative snippets
    const negativeKeywords = ['arnaque', 'scam', 'fake', 'problème', 'avis négatif', 'bad']
    const negativeSnippets = organicResults
      .filter((r) =>
        negativeKeywords.some((kw) =>
          (r.snippet ?? '').toLowerCase().includes(kw),
        ),
      )
      .map((r) => r.snippet ?? '')
      .slice(0, 3)

    // Competitor positions from their respective queries
    const competitorPositions: Record<string, number | null> = {}
    for (let i = 0; i < profile.competitors.length && i < 2; i++) {
      const comp = profile.competitors[i]
      if (!comp) continue
      const compResult = results[3 + i]
      const compRaw = compResult?.status === 'fulfilled' ? (compResult.value as SerpResult | null) : null
      const compOrganics = compRaw?.organic_results ?? []
      const compDomain = new URL(comp.url).hostname.replace(/^www\./, '')
      const compEntry = compOrganics.find((r) => r.link?.toLowerCase().includes(compDomain))
      competitorPositions[comp.name] = compEntry?.position ?? null
    }

    const visibilityScore = extractVisibilityScore(officialSitePosition)
    const reputationScore = Math.max(0, visibilityScore - negativeSnippets.length * 10)

    return {
      success: true,
      data: {
        official_site_position: officialSitePosition,
        negative_snippets: negativeSnippets,
        competitor_positions: competitorPositions,
        visibility_score: visibilityScore,
        reputation_score: reputationScore,
      },
      source: 'serp',
    }
  } catch (err) {
    return {
      success: false,
      data: null,
      source: 'serp',
      error: { code: 'FETCH_FAILED', message: String(err) },
    }
  }
}
