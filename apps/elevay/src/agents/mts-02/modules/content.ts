import { composio } from '@/agents/_shared/composio'
import type { ModuleResult, AgentProfile } from '@/agents/_shared/types'
import type { TrendsData, ContentData } from '../types'

interface SerpResult {
  organic_results?: Array<{ title?: string; link?: string }>
}

interface YoutubeResult {
  items?: Array<{
    snippet?: { title?: string }
    statistics?: { viewCount?: string }
  }>
}

// fetchContent is intentionally sequential — it receives TrendsData as input
// (C4 from correction.md: fetchContent() must receive TrendsData, not run in parallel)
export async function fetchContent(
  profile: AgentProfile,
  trends: TrendsData | null,
): Promise<ModuleResult<ContentData>> {
  try {
    // Derive keywords to analyse: trending ones first, fallback to profile keywords
    const keywordsToAnalyse = trends
      ? trends.keywords
          .filter((k) => k.trend_direction === 'up')
          .slice(0, 5)
          .map((k) => k.term)
      : [profile.primary_keyword, profile.secondary_keyword]

    if (keywordsToAnalyse.length === 0) {
      keywordsToAnalyse.push(profile.primary_keyword)
    }

    const brandDomain = new URL(profile.brand_url).hostname.replace(/^www\./, '')

    const [serpResults, youtubeResults] = await Promise.allSettled([
      Promise.allSettled(
        keywordsToAnalyse.map((kw) => composio.searchSerp(kw, 5)),
      ),
      Promise.allSettled(
        keywordsToAnalyse.map((kw) => composio.getYoutube(kw)),
      ),
    ])

    const serpSettled =
      serpResults.status === 'fulfilled' ? serpResults.value : []
    const ytSettled =
      youtubeResults.status === 'fulfilled' ? youtubeResults.value : []

    const topSerpResults = keywordsToAnalyse.map((kw, i) => {
      const raw =
        serpSettled[i]?.status === 'fulfilled'
          ? (serpSettled[i]?.value as SerpResult | null)
          : null
      const organics = raw?.organic_results ?? []
      return {
        keyword: kw,
        titles: organics.map((r) => r.title ?? '').filter(Boolean).slice(0, 3),
        domains: organics.map((r) => r.link ?? '').filter(Boolean).slice(0, 3),
      }
    })

    const youtubeVideos = keywordsToAnalyse.map((kw, i) => {
      const raw =
        ytSettled[i]?.status === 'fulfilled'
          ? (ytSettled[i]?.value as YoutubeResult | null)
          : null
      const items = raw?.items ?? []
      return {
        keyword: kw,
        titles: items.map((v) => v.snippet?.title ?? '').filter(Boolean).slice(0, 3),
        views: items
          .map((v) => parseInt(v.statistics?.viewCount ?? '0', 10))
          .slice(0, 3),
      }
    })

    // Content gaps: trending keywords where brand domain is not in top SERP results
    const contentGaps = topSerpResults
      .filter((r) => !r.domains.some((d) => d.includes(brandDomain)))
      .map((r) => r.keyword)

    return {
      success: true,
      data: {
        top_serp_results: topSerpResults,
        youtube_videos: youtubeVideos,
        content_gaps: contentGaps,
      },
      source: 'content',
    }
  } catch (err) {
    return {
      success: false,
      data: null,
      source: 'content',
      error: { code: 'FETCH_FAILED', message: String(err) },
    }
  }
}
