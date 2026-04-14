import { composio } from '@/agents/_shared/composio'
import type { ModuleResult, AgentProfile } from '@/agents/_shared/types'
import type { GoogleMapsData } from '../types'

interface SerpMapsResult {
  local_results?: Array<{
    rating?: number
    reviews?: number
    title?: string
  }>
}

export async function fetchGoogleMaps(profile: AgentProfile): Promise<ModuleResult<GoogleMapsData>> {
  try {
    // Use SERP with "maps" context to find local business ratings
    const query = `${profile.brand_name} avis google maps`
    const raw = (await composio.searchSerp(query, 5)) as SerpMapsResult | null

    if (!raw) {
      return { success: false, data: null, source: 'google-maps', degraded: true }
    }

    const localResults = raw.local_results ?? []
    const topResult = localResults[0]

    if (!topResult) {
      // No local results — brand may not have a Maps listing
      return {
        success: true,
        data: {
          rating: null,
          review_count: 0,
          recent_sentiment: 'neutral',
        },
        source: 'google-maps',
        degraded: true,
      }
    }

    const rating = topResult.rating ?? null
    const recentSentiment: GoogleMapsData['recent_sentiment'] =
      rating === null ? 'neutral'
        : rating >= 4 ? 'positive'
          : rating >= 3 ? 'neutral'
            : 'negative'

    return {
      success: true,
      data: {
        rating,
        review_count: topResult.reviews ?? 0,
        recent_sentiment: recentSentiment,
      },
      source: 'google-maps',
    }
  } catch (err) {
    return {
      success: false,
      data: null,
      source: 'google-maps',
      error: { code: 'FETCH_FAILED', message: String(err) },
    }
  }
}
