import { composio } from '@/agents/_shared/composio'
import type { AgentProfile, ModuleResult } from '@/agents/_shared/types'
import type { SeoAcquisitionData } from '../types'

interface KeywordEntry {
  keyword?: string
  position?: number
  search_volume?: number
  competition?: number
}

interface KeywordsResponse {
  results?: KeywordEntry[]
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function estimateDomainAuthority(keywords: KeywordEntry[]): number | null {
  if (keywords.length === 0) return null
  // Heuristic: more keywords in top positions → higher DA
  const topPositions = keywords.filter((k) => (k.position ?? 100) <= 10).length
  const ratio = topPositions / Math.max(keywords.length, 1)
  return Math.round(ratio * 80 + 10) // 10-90 range
}

function estimateTraffic(keywords: KeywordEntry[]): number | null {
  if (keywords.length === 0) return null
  return keywords.reduce((sum, k) => {
    const vol = k.search_volume ?? 0
    const pos = k.position ?? 100
    // CTR curve approximation
    const ctr = pos <= 1 ? 0.3 : pos <= 3 ? 0.15 : pos <= 10 ? 0.05 : 0.01
    return sum + vol * ctr
  }, 0)
}

export async function fetchSeoAcquisition(
  profile: AgentProfile,
): Promise<ModuleResult<SeoAcquisitionData>> {
  try {
    const brandDomain = extractDomain(profile.brand_url)
    const allKeywords = [
      profile.primary_keyword,
      profile.secondary_keyword,
      ...profile.competitors.map((c) => c.name),
    ].filter(Boolean)

    const raw = await composio.getKeywords(allKeywords, profile.country)

    if (!raw) {
      return {
        success: false,
        data: null,
        source: 'seo-acquisition',
        degraded: true,
        error: { code: 'NO_DATA', message: 'Keywords API returned null' },
      }
    }

    const response = raw as KeywordsResponse
    const allResults = response.results ?? []

    // Brand keywords: those that match brand domain or brand keywords
    const brandKeywords = allResults.filter(
      (k) =>
        k.keyword?.toLowerCase().includes(profile.primary_keyword.toLowerCase()) ||
        k.keyword?.toLowerCase().includes(profile.secondary_keyword.toLowerCase()),
    )

    const brandTopKeywords = brandKeywords
      .filter((k) => k.position != null)
      .sort((a, b) => (a.position ?? 100) - (b.position ?? 100))
      .slice(0, 10)
      .map((k) => ({
        keyword: k.keyword ?? '',
        position: k.position ?? 0,
        volume: k.search_volume ?? 0,
      }))

    const brandSeo: SeoAcquisitionData['brand_seo'] = {
      domain: brandDomain,
      domain_authority: estimateDomainAuthority(brandKeywords),
      organic_traffic_estimate: estimateTraffic(brandKeywords),
      top_keywords: brandTopKeywords,
    }

    // Competitor SEO
    const brandKwSet = new Set(brandTopKeywords.map((k) => k.keyword.toLowerCase()))

    const competitorsSeo: SeoAcquisitionData['competitors_seo'] = profile.competitors.map((comp) => {
      const compDomain = extractDomain(comp.url)
      const compKeywords = allResults.filter(
        (k) => k.keyword?.toLowerCase().includes(comp.name.toLowerCase()),
      )
      const compKwSet = new Set(
        compKeywords.filter((k) => k.keyword).map((k) => k.keyword!.toLowerCase()),
      )

      // Overlap = keywords both brand and competitor appear for
      const overlap =
        brandKwSet.size > 0
          ? Math.round(
              ([...brandKwSet].filter((kw) => compKwSet.has(kw)).length / brandKwSet.size) * 100,
            )
          : 0

      return {
        domain: compDomain,
        domain_authority: estimateDomainAuthority(compKeywords),
        organic_traffic_estimate: estimateTraffic(compKeywords),
        keyword_overlap: overlap,
      }
    })

    return {
      success: true,
      data: { brand_seo: brandSeo, competitors_seo: competitorsSeo },
      source: 'seo-acquisition',
    }
  } catch (err) {
    return {
      success: false,
      data: null,
      source: 'seo-acquisition',
      error: { code: 'FETCH_FAILED', message: String(err) },
    }
  }
}
