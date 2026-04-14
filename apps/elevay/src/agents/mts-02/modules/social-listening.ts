import { composio } from '@/agents/_shared/composio'
import type { ModuleResult, AgentProfile } from '@/agents/_shared/types'
import type { SocialSignalsData } from '../types'

interface SerpResult {
  organic_results?: Array<{
    title?: string
    snippet?: string
    link?: string
  }>
}

function deriveEngagement(snippet: string): 'high' | 'medium' | 'low' {
  const highSignals = ['viral', 'trending', 'millier', 'million', 'likes', 'partages', 'views']
  const mediumSignals = ['populaire', 'commentaires', 'réactions', 'shares']
  const text = snippet.toLowerCase()
  if (highSignals.some((s) => text.includes(s))) return 'high'
  if (mediumSignals.some((s) => text.includes(s))) return 'medium'
  return 'low'
}

function extractSignal(title: string, snippet: string): string {
  const text = title || snippet
  return text.length > 120 ? text.slice(0, 120) + '…' : text
}

export async function fetchSocialListening(
  profile: AgentProfile,
): Promise<ModuleResult<SocialSignalsData>> {
  try {
    const queries = [
      `${profile.primary_keyword} site:linkedin.com`,
      `${profile.primary_keyword} site:twitter.com OR site:x.com`,
    ]

    const results = await Promise.allSettled(
      queries.map((q) => composio.searchSerp(q, 5)),
    )

    const signals: SocialSignalsData['signals'] = []

    const platforms = ['LinkedIn', 'X/Twitter']
    results.forEach((result, i) => {
      const platform = platforms[i] ?? 'Social'
      if (result.status !== 'fulfilled') return
      const raw = result.value as SerpResult | null
      const organics = raw?.organic_results ?? []
      organics.slice(0, 3).forEach((r) => {
        const snippet = r.snippet ?? ''
        const title = r.title ?? ''
        if (!title && !snippet) return
        signals.push({
          platform,
          signal: extractSignal(title, snippet),
          engagement_indicator: deriveEngagement(snippet),
        })
      })
    })

    if (signals.length === 0) {
      return { success: false, data: null, source: 'social-listening', degraded: true }
    }

    return {
      success: true,
      data: { signals },
      source: 'social-listening',
    }
  } catch (err) {
    return {
      success: false,
      data: null,
      source: 'social-listening',
      error: { code: 'FETCH_FAILED', message: String(err) },
    }
  }
}
