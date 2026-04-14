import { composio } from '@/agents/_shared/composio'
import type { ModuleResult, AgentProfile } from '@/agents/_shared/types'
import type { CompetitiveContentData } from '../types'

interface ScrapedPage {
  content?: string
  markdown?: string
}

function extractThemes(text: string): string[] {
  const themePatterns = [
    /\b(stratégie|strategy)\b/i,
    /\b(marketing|marketing digital)\b/i,
    /\b(innovation|tech|technologie)\b/i,
    /\b(growth|croissance)\b/i,
    /\b(leadership|management)\b/i,
    /\b(seo|référencement)\b/i,
    /\b(data|analytics)\b/i,
    /\b(produit|product)\b/i,
  ]
  return themePatterns
    .filter((p) => p.test(text))
    .map((p) => p.source.replace(/\\b|\(|\)|\/i/g, '').split('|')[0] ?? '')
    .filter(Boolean)
    .slice(0, 5)
}

function estimateFrequency(content: string): string {
  const datePatterns = content.match(
    /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2}/g,
  )
  const count = datePatterns?.length ?? 0
  if (count >= 12) return '3x/week+'
  if (count >= 4) return '1x/week'
  if (count >= 2) return '2x/month'
  if (count >= 1) return '1x/month'
  return 'Irregular'
}

export async function fetchCompetitive(
  profile: AgentProfile,
): Promise<ModuleResult<CompetitiveContentData>> {
  try {
    const competitors = profile.competitors.slice(0, 3)
    if (competitors.length === 0) {
      return { success: false, data: null, source: 'competitive', degraded: true }
    }

    const scrapeResults = await Promise.allSettled(
      competitors.map((c) => {
        const blogUrl = c.url.replace(/\/$/, '') + '/blog'
        return composio.scrapeUrl(blogUrl)
      }),
    )

    const competitorData = competitors.map((c, i) => {
      const result = scrapeResults[i]
      const raw =
        result?.status === 'fulfilled'
          ? (result.value as ScrapedPage | null)
          : null
      const text = raw?.markdown ?? raw?.content ?? ''

      return {
        name: c.name,
        publishing_frequency: text ? estimateFrequency(text) : 'Unknown',
        content_themes: text ? extractThemes(text) : [],
        has_youtube: text.toLowerCase().includes('youtube'),
        has_lead_magnets:
          text.toLowerCase().includes('download') ||
          text.toLowerCase().includes('download') ||
          text.toLowerCase().includes('ebook') ||
          text.toLowerCase().includes('guide'),
      }
    })

    const hasAnyData = competitorData.some((c) => c.publishing_frequency !== 'Unknown')
    if (!hasAnyData) {
      return { success: false, data: null, source: 'competitive', degraded: true }
    }

    return {
      success: true,
      data: { competitors: competitorData },
      source: 'competitive',
    }
  } catch (err) {
    return {
      success: false,
      data: null,
      source: 'competitive',
      error: { code: 'FETCH_FAILED', message: String(err) },
    }
  }
}
