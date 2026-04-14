import { composio } from '@/agents/_shared/composio'
import type { AgentProfile, ModuleResult } from '@/agents/_shared/types'
import type { ContentAnalysisData } from '../types'

interface ScrapedPage {
  markdown?: string
  metadata?: {
    title?: string
    description?: string
  }
}

interface SerpResult {
  organic_results?: Array<{
    title?: string
    link?: string
    snippet?: string
    position?: number
  }>
}

function extractBlogFrequency(markdown: string): string {
  // Count article-like headings as proxy
  const articleCount = (markdown.match(/^##?\s+/gm) ?? []).length
  if (articleCount >= 10) return '3+/week'
  if (articleCount >= 5) return '1-2/week'
  if (articleCount >= 2) return '1/week'
  if (articleCount >= 1) return '< 1/week'
  return 'Unknown'
}

function extractThemes(markdown: string): string[] {
  const headings = markdown.match(/^##?\s+(.+)$/gm) ?? []
  const themes = headings
    .map((h) => h.replace(/^##?\s+/, '').trim())
    .filter((h) => h.length > 3 && h.length < 100)
    .slice(0, 10)
  return [...new Set(themes)]
}

function estimateWordCount(markdown: string): number | null {
  if (!markdown) return null
  const words = markdown.split(/\s+/).length
  // Average per article (rough)
  const articles = Math.max((markdown.match(/^##?\s+/gm) ?? []).length, 1)
  return Math.round(words / articles)
}

function hasYoutubeEmbeds(markdown: string): boolean {
  return /youtube\.com|youtu\.be/i.test(markdown)
}

function hasLeadMagnets(markdown: string): boolean {
  return /télécharg|download|ebook|guide\s+gratuit|free\s+guide|whitepaper|webinar|newsletter/i.test(
    markdown,
  )
}

export async function fetchContentAnalysis(
  profile: AgentProfile,
): Promise<ModuleResult<ContentAnalysisData>> {
  try {
    // Scrape brand blog + competitor blogs
    const blogUrls = [
      { name: profile.brand_name, url: `${profile.brand_url.replace(/\/$/, '')}/blog`, isBrand: true },
      ...profile.competitors.map((c) => ({
        name: c.name,
        url: `${c.url.replace(/\/$/, '')}/blog`,
        isBrand: false,
      })),
    ]

    const scrapeResults = await Promise.allSettled(
      blogUrls.map((entry) => composio.scrapeUrl(entry.url)),
    )

    // Brand content
    const brandScrape = scrapeResults[0]
    const brandMarkdown =
      brandScrape?.status === 'fulfilled'
        ? ((brandScrape.value as ScrapedPage | null)?.markdown ?? '')
        : ''

    const brandContent: ContentAnalysisData['brand_content'] = {
      blog_frequency: extractBlogFrequency(brandMarkdown),
      avg_word_count: estimateWordCount(brandMarkdown),
      content_themes: extractThemes(brandMarkdown),
      has_youtube: hasYoutubeEmbeds(brandMarkdown),
      has_lead_magnets: hasLeadMagnets(brandMarkdown),
    }

    // Competitor content
    const competitorsContent: ContentAnalysisData['competitors_content'] = []
    for (let i = 0; i < profile.competitors.length; i++) {
      const comp = profile.competitors[i]!
      const result = scrapeResults[i + 1]
      const markdown =
        result?.status === 'fulfilled'
          ? ((result.value as ScrapedPage | null)?.markdown ?? '')
          : ''

      const themes = extractThemes(markdown)
      const brandThemeSet = new Set(brandContent.content_themes.map((t) => t.toLowerCase()))
      const uniqueAngles = themes.filter((t) => !brandThemeSet.has(t.toLowerCase()))

      competitorsContent.push({
        name: comp.name,
        blog_frequency: extractBlogFrequency(markdown),
        content_themes: themes,
        has_youtube: hasYoutubeEmbeds(markdown),
        unique_angles: uniqueAngles.slice(0, 5),
      })
    }

    // Content gap map: search for sector keywords and check brand coverage
    const gapKeywords = [profile.primary_keyword, profile.secondary_keyword].filter(Boolean)
    const serpResults = await Promise.allSettled(
      gapKeywords.map((kw) => composio.searchSerp(kw, 10)),
    )

    const brandDomain = new URL(profile.brand_url).hostname.replace(/^www\./, '')
    const contentGapMap: ContentAnalysisData['content_gap_map'] = []

    for (let i = 0; i < gapKeywords.length; i++) {
      const kw = gapKeywords[i]!
      const result = serpResults[i]
      const raw =
        result?.status === 'fulfilled' ? (result.value as SerpResult | null) : null
      const organics = raw?.organic_results ?? []

      const brandInTop10 = organics.some((r) =>
        r.link?.toLowerCase().includes(brandDomain),
      )

      if (!brandInTop10) {
        contentGapMap.push({
          keyword: kw,
          brand_covered: false,
          opportunity: `Brand not in top 10 for "${kw}" — content opportunity`,
        })
      } else {
        contentGapMap.push({
          keyword: kw,
          brand_covered: true,
          opportunity: `Already ranking — optimize existing content`,
        })
      }
    }

    return {
      success: true,
      data: {
        brand_content: brandContent,
        competitors_content: competitorsContent,
        content_gap_map: contentGapMap,
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
