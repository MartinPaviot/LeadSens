import { composio } from '@/agents/_shared/composio'
import type { ModuleResult, AgentProfile } from '@/agents/_shared/types'
import type { BenchmarkData } from '../types'

interface SerpResult {
  organic_results?: Array<{
    position?: number
    link?: string
    snippet?: string
  }>
}

function scoreCompetitor(
  results: NonNullable<SerpResult['organic_results']>,
  domain: string,
): number {
  const entry = results.find((r) =>
    r.link?.toLowerCase().includes(domain),
  )
  if (!entry) return 20
  const pos = entry.position ?? 20
  return Math.max(0, Math.round(100 - (pos - 1) * 5))
}

export async function fetchBenchmark(profile: AgentProfile): Promise<ModuleResult<BenchmarkData>> {
  try {
    const competitors = profile.competitors.slice(0, 3)
    if (competitors.length === 0) {
      return { success: false, data: null, source: 'benchmark', degraded: true }
    }

    const serpResults = await Promise.allSettled(
      competitors.map((c) => composio.searchSerp(c.name, 10)),
    )

    const competitorScores = competitors.map((c, i) => {
      const result = serpResults[i]
      const raw = result?.status === 'fulfilled' ? (result.value as SerpResult | null) : null
      const organic = raw?.organic_results ?? []
      const compDomain = new URL(c.url).hostname.replace(/^www\./, '')
      const serpScore = scoreCompetitor(organic, compDomain)

      return {
        name: c.name,
        overall_score: serpScore,
        dimensions: {
          serp_visibility: serpScore,
        },
      }
    })

    // Score the brand itself
    const brandResult = await composio.searchSerp(profile.brand_name, 10)
    const brandRaw = brandResult as SerpResult | null
    const brandOrganic = brandRaw?.organic_results ?? []
    const brandDomain = new URL(profile.brand_url).hostname.replace(/^www\./, '')
    const brandScore = scoreCompetitor(brandOrganic, brandDomain)

    const allScores = [...competitorScores.map((c) => c.overall_score), brandScore]
    const brandRank =
      allScores.filter((s) => s > brandScore).length + 1

    const avgCompScore =
      competitorScores.reduce((s, c) => s + c.overall_score, 0) /
      Math.max(1, competitorScores.length)
    const benchmarkScore = Math.round(
      brandScore >= avgCompScore ? 60 + (brandScore - avgCompScore) * 0.4 : Math.max(10, brandScore * 0.8),
    )

    return {
      success: true,
      data: {
        competitors: competitorScores,
        brand_rank: brandRank,
        benchmark_score: Math.min(100, benchmarkScore),
      },
      source: 'benchmark',
    }
  } catch (err) {
    return {
      success: false,
      data: null,
      source: 'benchmark',
      error: { code: 'FETCH_FAILED', message: String(err) },
    }
  }
}
