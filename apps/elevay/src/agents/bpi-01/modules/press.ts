import { composio } from '@/agents/_shared/composio'
import type { ModuleResult, AgentProfile } from '@/agents/_shared/types'
import type { PressData } from '../types'

interface GNewsResult {
  articles?: Array<{
    title?: string
    source?: { name?: string; url?: string }
    content?: string
    description?: string
  }>
  totalArticles?: number
}

function deriveSentiment(articles: GNewsResult['articles']): PressData['sentiment'] {
  if (!articles?.length) return 'neutral'
  const positive = ['succès', 'lancemen', 'croissance', 'innov', 'prix', 'award', 'leader']
  const negative = ['scandale', 'crise', 'problème', 'chute', 'déficit', 'fraude', 'arnaque']
  let pos = 0
  let neg = 0
  for (const a of articles) {
    const text = ((a.title ?? '') + ' ' + (a.description ?? '')).toLowerCase()
    if (positive.some((kw) => text.includes(kw))) pos++
    if (negative.some((kw) => text.includes(kw))) neg++
  }
  if (pos > neg * 2) return 'positive'
  if (neg > pos * 2) return 'negative'
  if (pos > 0 && neg > 0) return 'mixed'
  return 'neutral'
}

export async function fetchPress(profile: AgentProfile): Promise<ModuleResult<PressData>> {
  try {
    const raw = (await composio.searchNews(profile.brand_name, profile.language)) as GNewsResult | null

    if (!raw) {
      return { success: false, data: null, source: 'press', degraded: true }
    }

    const articles = raw.articles ?? []
    const topDomains = [
      ...new Set(
        articles
          .map((a) => a.source?.name ?? a.source?.url ?? '')
          .filter(Boolean)
          .slice(0, 5),
      ),
    ]

    const sentiment = deriveSentiment(articles)

    const editorialAngle =
      articles.length === 0
        ? 'No press coverage detected'
        : sentiment === 'positive'
          ? 'Mostly positive coverage'
          : sentiment === 'negative'
            ? 'Negative coverage — attention required'
            : 'Neutral to mixed coverage'

    const prOpportunities: string[] = []
    if (articles.length < 3) prOpportunities.push('Augmenter la présence presse via communiqués')
    if (sentiment === 'negative') prOpportunities.push('Stratégie de relations presse corrective')
    if (topDomains.length < 2) prOpportunities.push('Diversifier les sources médias')

    return {
      success: true,
      data: {
        article_count: raw.totalArticles ?? articles.length,
        sentiment,
        editorial_angle: editorialAngle,
        top_domains: topDomains,
        pr_opportunities: prOpportunities,
      },
      source: 'press',
    }
  } catch (err) {
    return {
      success: false,
      data: null,
      source: 'press',
      error: { code: 'FETCH_FAILED', message: String(err) },
    }
  }
}
