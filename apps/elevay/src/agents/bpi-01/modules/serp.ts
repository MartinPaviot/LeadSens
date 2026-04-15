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

/** SERP position → visibility score mapping */
const VISIBILITY_SCORES = [
  { maxPosition: 1, score: 100 },
  { maxPosition: 3, score: 85 },
  { maxPosition: 5, score: 70 },
  { maxPosition: 10, score: 50 },
] as const
const VISIBILITY_FALLBACK = 20
const NEGATIVE_PENALTY_PER_SNIPPET = 10

function extractVisibilityScore(position: number | null): number {
  if (position === null) return 0
  for (const tier of VISIBILITY_SCORES) {
    if (position <= tier.maxPosition) return tier.score
  }
  return VISIBILITY_FALLBACK
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

    // Negative snippets — multilingual detection
    const NEGATIVE_KEYWORDS_BY_LANG: Record<string, string[]> = {
      fr: ['arnaque', 'scam', 'fake', 'problème', 'avis négatif', 'fraude', 'mauvais'],
      en: ['scam', 'fake', 'fraud', 'problem', 'bad review', 'terrible', 'avoid', 'worst'],
      es: ['estafa', 'fraude', 'problema', 'malo', 'evitar'],
      de: ['betrug', 'fake', 'problem', 'schlecht', 'vermeiden'],
    }
    const lang = (profile.language ?? 'en').slice(0, 2).toLowerCase()
    const negativeKeywords = [
      ...(NEGATIVE_KEYWORDS_BY_LANG[lang] ?? []),
      ...(lang !== 'en' ? (NEGATIVE_KEYWORDS_BY_LANG['en'] ?? []) : []),
    ]
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
    const reputationScore = Math.max(0, visibilityScore - negativeSnippets.length * NEGATIVE_PENALTY_PER_SNIPPET)

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
