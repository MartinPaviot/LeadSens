import { composio } from '@/agents/_shared/composio'
import type { ModuleResult, AgentProfile } from '@/agents/_shared/types'
import type { TrustpilotData } from '../types'

interface ScrapedPage {
  content?: string
  markdown?: string
}

export async function fetchTrustpilot(profile: AgentProfile): Promise<ModuleResult<TrustpilotData>> {
  try {
    const domain = new URL(profile.brand_url).hostname.replace(/^www\./, '')
    const url = `https://www.trustpilot.com/review/${domain}`
    const raw = (await composio.scrapeUrl(url)) as ScrapedPage | null

    if (!raw) {
      return { success: false, data: null, source: 'trustpilot', degraded: true }
    }

    const content = raw.markdown ?? raw.content ?? ''

    // Parse rating from content (e.g. "4.2 out of 5" or "TrustScore 4.2")
    const ratingMatch = content.match(/TrustScore\s+([\d.]+)|(\d+(?:\.\d+)?)\s*(?:out of|\/)\s*5/i)
    const rating = ratingMatch
      ? parseFloat(ratingMatch[1] ?? ratingMatch[2] ?? '0')
      : null

    // Parse review count (e.g. "1,234 reviews")
    const reviewMatch = content.match(/([\d,]+)\s+(?:reviews?|avis)/i)
    const reviewCount = reviewMatch
      ? parseInt((reviewMatch[1] ?? '0').replace(/,/g, ''), 10)
      : 0

    const trustScore =
      rating === null
        ? 0
        : Math.round((rating / 5) * 100)

    return {
      success: true,
      data: {
        rating,
        review_count: reviewCount,
        trust_score: trustScore,
      },
      source: 'trustpilot',
    }
  } catch (err) {
    return {
      success: false,
      data: null,
      source: 'trustpilot',
      error: { code: 'FETCH_FAILED', message: String(err) },
    }
  }
}
