import { composio } from '@/agents/_shared/composio'
import type { AgentProfile, ModuleResult } from '@/agents/_shared/types'
import type { MessagingAnalysis } from '../types'

interface ScrapedPage {
  markdown?: string
  metadata?: {
    title?: string
    description?: string
  }
}

function extractHeroMessage(markdown: string): string {
  // First h1 or first line
  const h1Match = markdown.match(/^#\s+(.+)$/m)
  if (h1Match?.[1]) return h1Match[1].trim()
  const firstLine = markdown.split('\n').find((l) => l.trim().length > 10)
  return firstLine?.trim().slice(0, 200) ?? ''
}

function extractValueProp(markdown: string, description: string | undefined): string {
  if (description) return description.slice(0, 300)
  // First paragraph after h1
  const afterH1 = markdown.split(/^#\s+.+$/m)[1]
  if (afterH1) {
    const para = afterH1.split('\n').find((l) => l.trim().length > 20)
    return para?.trim().slice(0, 300) ?? ''
  }
  return ''
}

function extractCta(markdown: string): string {
  const ctaPatterns = [
    /\[([^\]]*(?:essai|demo|start|commencer|inscription|sign\s*up|get\s*started|try)[^\]]*)\]/i,
    /\[([^\]]*(?:gratuit|free|contact)[^\]]*)\]/i,
    /\[([^\]]+)\]\([^)]+\)/,
  ]
  for (const pattern of ctaPatterns) {
    const match = markdown.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return ''
}

function detectPricingPosture(markdown: string): MessagingAnalysis['pricing_posture'] {
  const lower = markdown.toLowerCase()
  if (/gratuit|free\s*plan|freemium|0\s*€/.test(lower)) return 'freemium'
  if (/premium|enterprise|sur[\s-]mesure|custom/.test(lower)) return 'premium'
  if (/à\s*partir\s*de|starting\s*at|from\s*\$?\d/.test(lower)) return 'mid-market'
  if (/pas\s*cher|low[\s-]cost|économique|budget/.test(lower)) return 'low-cost'
  return 'unknown'
}

function extractDominantAngle(hero: string, valueProp: string): string {
  const combined = `${hero} ${valueProp}`.toLowerCase()
  if (/rapidité|fast|speed|rapide|instant/.test(combined)) return 'Speed / performance'
  if (/simple|facile|easy|intuiti/.test(combined)) return 'Simplicity / ease of use'
  if (/tout[\s-]en[\s-]un|all[\s-]in[\s-]one|complet/.test(combined)) return 'Complete solution'
  if (/prix|price|abordable|affordable|économi/.test(combined)) return 'Competitive pricing'
  if (/sécur|secur|confiance|trust/.test(combined)) return 'Security / trust'
  if (/innov|intelligence|ai|ia/.test(combined)) return 'Innovation / technology'
  return 'Unidentified'
}

function calculateClarityScore(hero: string, cta: string, valueProp: string): number {
  let score = 30 // base
  if (hero.length > 5 && hero.length < 150) score += 25
  if (cta.length > 0) score += 20
  if (valueProp.length > 20) score += 25
  return Math.min(100, score)
}

function calculateDifferentiationScore(brandAngle: string, competitorAngle: string): number {
  if (!brandAngle || !competitorAngle) return 50
  if (brandAngle === competitorAngle) return 20
  if (brandAngle === 'Unidentified' || competitorAngle === 'Unidentified') return 50
  return 75 // different angles
}

function buildFailedAnalysis(url: string): MessagingAnalysis {
  return {
    competitor_url: url,
    hero_message: '',
    value_prop: '',
    primary_cta: '',
    pricing_posture: 'unknown',
    dominant_angle: '',
    messaging_clarity_score: 50,
    differentiation_score: 50,
    scraping_success: false,
  }
}

export async function fetchProductMessaging(
  profile: AgentProfile,
): Promise<ModuleResult<MessagingAnalysis[]>> {
  try {
    const urls = [
      { name: profile.brand_name, url: profile.brand_url, isBrand: true },
      ...profile.competitors.map((c) => ({ name: c.name, url: c.url, isBrand: false })),
    ]

    const scrapeResults = await Promise.allSettled(
      urls.map((entry) => composio.scrapeUrl(entry.url)),
    )

    let brandAngle = ''
    const analyses: MessagingAnalysis[] = []

    for (let i = 0; i < urls.length; i++) {
      const entry = urls[i]!
      const result = scrapeResults[i]!

      if (result.status === 'rejected' || !result.value) {
        analyses.push(buildFailedAnalysis(entry.url))
        continue
      }

      const scraped = result.value as ScrapedPage
      const markdown = scraped.markdown ?? ''
      const description = scraped.metadata?.description

      const hero = extractHeroMessage(markdown)
      const valueProp = extractValueProp(markdown, description)
      const cta = extractCta(markdown)
      const pricing = detectPricingPosture(markdown)
      const angle = extractDominantAngle(hero, valueProp)
      const clarity = calculateClarityScore(hero, cta, valueProp)

      if (entry.isBrand) brandAngle = angle

      const differentiation = entry.isBrand
        ? 100
        : calculateDifferentiationScore(brandAngle, angle)

      analyses.push({
        competitor_url: entry.url,
        hero_message: hero.slice(0, 200),
        value_prop: valueProp.slice(0, 300),
        primary_cta: cta.slice(0, 100),
        pricing_posture: pricing,
        dominant_angle: angle,
        messaging_clarity_score: clarity,
        differentiation_score: differentiation,
        scraping_success: true,
      })
    }

    return { success: true, data: analyses, source: 'product-messaging' }
  } catch (err) {
    return {
      success: false,
      data: null,
      source: 'product-messaging',
      error: { code: 'FETCH_FAILED', message: String(err) },
    }
  }
}
