import { composio } from '@/agents/_shared/composio'
import type { ModuleResult, AgentProfile } from '@/agents/_shared/types'
import type { YoutubeData } from '../types'

interface YoutubeResult {
  items?: Array<{
    snippet?: {
      title?: string
      channelTitle?: string
      description?: string
    }
    statistics?: {
      viewCount?: string
    }
  }>
}

function deriveYoutubeSentiment(
  items: YoutubeResult['items'],
): YoutubeData['sentiment'] {
  if (!items?.length) return 'neutral'
  const positive = ['tuto', 'review', 'test', 'super', 'top', 'meilleur', 'recommend']
  const negative = ['arnaque', 'fake', 'problème', 'scam', 'bad', 'avoid']
  let pos = 0
  let neg = 0
  for (const item of items) {
    const text = (
      (item.snippet?.title ?? '') +
      ' ' +
      (item.snippet?.description ?? '')
    ).toLowerCase()
    if (positive.some((kw) => text.includes(kw))) pos++
    if (negative.some((kw) => text.includes(kw))) neg++
  }
  if (pos > neg * 2) return 'positive'
  if (neg > pos * 2) return 'negative'
  if (pos > 0 && neg > 0) return 'mixed'
  return 'neutral'
}

export async function fetchYoutube(profile: AgentProfile): Promise<ModuleResult<YoutubeData>> {
  try {
    const raw = (await composio.getYoutube(profile.brand_name)) as YoutubeResult | null

    if (!raw) {
      return { success: false, data: null, source: 'youtube', degraded: true }
    }

    const items = raw.items ?? []

    const topVideos = items.slice(0, 5).map((item) => ({
      title: item.snippet?.title ?? 'Unknown',
      views: parseInt(item.statistics?.viewCount ?? '0', 10),
      channel: item.snippet?.channelTitle ?? 'Unknown',
    }))

    const sentiment = deriveYoutubeSentiment(items)
    const reputationScore = Math.min(
      100,
      Math.round(
        (items.length > 0 ? 40 : 0) +
          (sentiment === 'positive' ? 40 : sentiment === 'neutral' ? 20 : 0) +
          Math.min(20, items.length * 2),
      ),
    )

    const influencerOpportunities: string[] = []
    if (items.length < 5) influencerOpportunities.push('Niche YouTuber partnerships')
    if (sentiment !== 'positive') influencerOpportunities.push('Authentic content campaign')

    return {
      success: true,
      data: {
        video_count: items.length,
        top_videos: topVideos,
        sentiment,
        influencer_opportunities: influencerOpportunities,
        reputation_score: reputationScore,
      },
      source: 'youtube',
    }
  } catch (err) {
    return {
      success: false,
      data: null,
      source: 'youtube',
      error: { code: 'FETCH_FAILED', message: String(err) },
    }
  }
}
