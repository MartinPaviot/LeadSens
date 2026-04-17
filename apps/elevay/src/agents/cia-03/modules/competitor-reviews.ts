import { composio } from '@/agents/_shared/composio'
import type { ModuleResult, AgentProfile } from '@/agents/_shared/types'

interface SerpMapsResult {
  local_results?: Array<{
    rating?: number
    reviews?: number
    title?: string
  }>
}

interface ScrapedPage {
  content?: string
  markdown?: string
}

export interface CompetitorReview {
  competitor: string
  google_maps: { rating: number; review_count: number; sentiment: 'positive' | 'neutral' | 'negative' } | null
  trustpilot: { trust_score: number; rating: number; review_count: number } | null
}

export interface CompetitorReviewsData {
  reviews: CompetitorReview[]
}

async function fetchMapsForCompetitor(name: string): Promise<CompetitorReview['google_maps']> {
  try {
    const raw = (await composio.searchSerp(`${name} avis google maps`, 5)) as SerpMapsResult | null
    const top = raw?.local_results?.[0]
    if (!top?.rating) return null
    const sentiment: 'positive' | 'neutral' | 'negative' =
      top.rating >= 4 ? 'positive' : top.rating >= 3 ? 'neutral' : 'negative'
    return { rating: top.rating, review_count: top.reviews ?? 0, sentiment }
  } catch {
    return null
  }
}

async function fetchTrustpilotForCompetitor(name: string, url?: string): Promise<CompetitorReview['trustpilot']> {
  try {
    // Try to derive domain from competitor URL or name
    let domain = name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9.-]/g, '')
    if (url) {
      try { domain = new URL(url).hostname.replace(/^www\./, '') } catch { /* use name-based fallback */ }
    }

    const trustpilotUrl = `https://www.trustpilot.com/review/${domain}`
    const raw = (await composio.scrapeUrl(trustpilotUrl)) as ScrapedPage | null
    if (!raw) return null

    const content = raw.markdown ?? raw.content ?? ''
    const ratingMatch = content.match(/TrustScore\s+([\d.]+)|(\d+(?:\.\d+)?)\s*(?:out of|\/)\s*5/i)
    const rating = ratingMatch ? parseFloat(ratingMatch[1] ?? ratingMatch[2] ?? '0') : null
    if (!rating) return null

    const reviewMatch = content.match(/([\d,]+)\s+(?:reviews?|avis)/i)
    const reviewCount = reviewMatch ? parseInt((reviewMatch[1] ?? '0').replace(/,/g, ''), 10) : 0

    return { trust_score: Math.round((rating / 5) * 100), rating, review_count: reviewCount }
  } catch {
    return null
  }
}

/**
 * Fetch Google Maps ratings and Trustpilot reviews for each competitor.
 * Reuses the same patterns as BPI-01's google-maps.ts and trustpilot.ts.
 */
export async function fetchCompetitorReviews(
  profile: AgentProfile,
): Promise<ModuleResult<CompetitorReviewsData>> {
  try {
    const competitors = profile.competitors ?? []
    if (competitors.length === 0) {
      return { success: true, data: { reviews: [] }, source: 'competitor-reviews' }
    }

    // Fetch Google Maps + Trustpilot for each competitor in parallel
    const reviewPromises = competitors.map(async (comp) => {
      const [googleMaps, trustpilot] = await Promise.all([
        fetchMapsForCompetitor(comp.name),
        fetchTrustpilotForCompetitor(comp.name, comp.url),
      ])
      return { competitor: comp.name, google_maps: googleMaps, trustpilot }
    })

    const reviews = await Promise.all(reviewPromises)

    return {
      success: true,
      data: { reviews },
      source: 'competitor-reviews',
    }
  } catch (err) {
    return {
      success: false,
      data: null,
      source: 'competitor-reviews',
      error: { code: 'FETCH_FAILED', message: String(err) },
    }
  }
}
