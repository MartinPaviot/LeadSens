import { composio } from '@/agents/_shared/composio'
import type { AgentProfile, ModuleResult } from '@/agents/_shared/types'
import type { SocialProfile } from '../types'

interface SerpResult {
  organic_results?: Array<{
    snippet?: string
    link?: string
  }>
}

function extractFollowersFromSnippet(snippet: string): number | null {
  // Match patterns like "12K followers", "1.5M abonnés", "12 000 followers"
  const patterns = [
    /(\d[\d\s,.]*)\s*[kK]\s*(?:followers|abonnés|suiveurs)/,
    /(\d[\d\s,.]*)\s*[mM]\s*(?:followers|abonnés|suiveurs)/,
    /(\d[\d\s,.]*)\s*(?:followers|abonnés|suiveurs)/,
  ]

  for (const pattern of patterns) {
    const match = snippet.match(pattern)
    if (match?.[1]) {
      const numStr = match[1].replace(/[\s,]/g, '').replace(',', '.')
      const num = parseFloat(numStr)
      if (isNaN(num)) continue
      if (/[kK]/.test(snippet.slice(match.index ?? 0, (match.index ?? 0) + match[0].length + 2))) {
        return Math.round(num * 1000)
      }
      if (/[mM]/.test(snippet.slice(match.index ?? 0, (match.index ?? 0) + match[0].length + 2))) {
        return Math.round(num * 1_000_000)
      }
      return Math.round(num)
    }
  }
  return null
}

function extractEngagementRate(snippet: string): number | null {
  const match = snippet.match(/(\d+[.,]\d+)\s*%\s*(?:engagement|taux)/i)
  if (match?.[1]) {
    return parseFloat(match[1].replace(',', '.'))
  }
  return null
}

const PLATFORMS = ['LinkedIn', 'Twitter', 'Instagram', 'Facebook'] as const

export async function fetchSocialMedia(
  profile: AgentProfile,
): Promise<ModuleResult<SocialProfile[]>> {
  try {
    const entities = [
      { name: profile.brand_name, isBrand: true },
      ...profile.competitors.map((c) => ({ name: c.name, isBrand: false })),
    ]

    const queries = entities.flatMap((entity) =>
      PLATFORMS.map((platform) => ({
        entity: entity.name,
        platform,
        query: `"${entity.name}" ${platform} site:${platform.toLowerCase()}.com`,
      })),
    )

    const results = await Promise.allSettled(
      queries.map((q) => composio.searchSerp(q.query, 3)),
    )

    const profiles: SocialProfile[] = []

    for (let i = 0; i < queries.length; i++) {
      const q = queries[i]!
      const result = results[i]!

      const raw =
        result.status === 'fulfilled' ? (result.value as SerpResult | null) : null
      const snippets = raw?.organic_results ?? []
      const combinedText = snippets.map((s) => s.snippet ?? '').join(' ')

      const followers = extractFollowersFromSnippet(combinedText)
      const engagement = extractEngagementRate(combinedText)

      profiles.push({
        entity: q.entity,
        platform: q.platform,
        followers,
        posting_frequency: 'Not estimated',
        engagement_rate: engagement,
        dominant_formats: [],
      })
    }

    return { success: true, data: profiles, source: 'social-media' }
  } catch (err) {
    return {
      success: false,
      data: null,
      source: 'social-media',
      error: { code: 'FETCH_FAILED', message: String(err) },
    }
  }
}
