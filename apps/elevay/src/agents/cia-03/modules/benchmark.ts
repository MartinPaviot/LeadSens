import type { AgentProfile } from '@/agents/_shared/types'
import type {
  MessagingAnalysis,
  SeoAcquisitionData,
  SocialProfile,
  ContentAnalysisData,
  CompetitorScore,
  StrategicZone,
} from '../types'

const DIMENSION_WEIGHTS = {
  seo: 0.25,
  product: 0.25,
  social: 0.20,
  content: 0.20,
  positioning: 0.10,
} as const

function getLevel(score: number): CompetitorScore['level'] {
  if (score >= 80) return 'dominant'
  if (score >= 65) return 'strong'
  if (score >= 50) return 'competitive'
  if (score >= 35) return 'weak'
  return 'vulnerable'
}

function classifyZone(brandScore: number, avgCompetitorScore: number): StrategicZone['zone'] {
  const gap = brandScore - avgCompetitorScore
  if (gap <= -20) return 'red'
  if (avgCompetitorScore >= 70) return 'saturated'
  if (gap >= 15) return 'green'
  return 'neutral'
}

function deriveSeoScore(
  entity: string,
  seo: SeoAcquisitionData | null,
  isBrand: boolean,
): number {
  if (!seo) return 50
  if (isBrand) {
    const da = seo.brand_seo.domain_authority ?? 50
    const kwCount = Math.min(seo.brand_seo.top_keywords.length * 10, 50)
    return Math.min(100, Math.round((da + kwCount) / 2))
  }
  const comp = seo.competitors_seo.find((c) =>
    entity.toLowerCase().includes(c.domain.split('.')[0]?.toLowerCase() ?? ''),
  )
  if (!comp) return 50
  return comp.domain_authority ?? 50
}

function deriveProductScore(
  entity: string,
  messaging: MessagingAnalysis[] | null,
  isBrand: boolean,
): number {
  if (!messaging) return 50
  // Find matching messaging entry by URL or position
  const entry = isBrand
    ? messaging[0]
    : messaging.find((m) =>
        m.competitor_url.toLowerCase().includes(entity.toLowerCase()),
      )
  if (!entry) return 50
  if (!entry.scraping_success) return 50
  return Math.round((entry.messaging_clarity_score + entry.differentiation_score) / 2)
}

function deriveSocialScore(
  entity: string,
  social: SocialProfile[] | null,
  brandSocialScoreOverride?: number,
  isBrand?: boolean,
): number {
  if (isBrand && brandSocialScoreOverride !== undefined) return brandSocialScoreOverride
  if (!social) return 50
  const entityProfiles = social.filter(
    (p) => p.entity.toLowerCase() === entity.toLowerCase(),
  )
  if (entityProfiles.length === 0) return 50

  const scores = entityProfiles.map((p) => {
    if (p.followers === null) return 30
    if (p.followers >= 100000) return 90
    if (p.followers >= 10000) return 70
    if (p.followers >= 1000) return 50
    return 30
  })
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}

function deriveContentScore(
  entity: string,
  content: ContentAnalysisData | null,
  isBrand: boolean,
): number {
  if (!content) return 50
  if (isBrand) {
    let score = 30
    const bc = content.brand_content
    if (bc.content_themes.length > 3) score += 20
    if (bc.has_youtube) score += 15
    if (bc.has_lead_magnets) score += 15
    if (bc.avg_word_count && bc.avg_word_count > 800) score += 10
    if (bc.blog_frequency.includes('week')) score += 10
    return Math.min(100, score)
  }
  const comp = content.competitors_content.find(
    (c) => c.name.toLowerCase() === entity.toLowerCase(),
  )
  if (!comp) return 50
  let score = 30
  if (comp.content_themes.length > 3) score += 20
  if (comp.has_youtube) score += 15
  if (comp.unique_angles.length > 2) score += 15
  if (comp.blog_frequency.includes('week')) score += 10
  return Math.min(100, score)
}

function derivePositioningScore(
  entity: string,
  messaging: MessagingAnalysis[] | null,
  isBrand: boolean,
): number {
  if (!messaging) return 50
  const entry = isBrand
    ? messaging[0]
    : messaging.find((m) =>
        m.competitor_url.toLowerCase().includes(entity.toLowerCase()),
      )
  if (!entry || !entry.scraping_success) return 50
  // Positioning = differentiation + clarity weighted
  return Math.round(entry.differentiation_score * 0.6 + entry.messaging_clarity_score * 0.4)
}

const ZONE_AXES: StrategicZone['axis'][] = ['seo', 'product', 'social', 'content', 'paid', 'youtube']

const ZONE_DESCRIPTIONS: Record<StrategicZone['zone'], (axis: string) => string> = {
  red: (axis) => `Significant gap in ${axis} — competitors dominate`,
  saturated: (axis) => `${axis} is saturated — costly to gain market share`,
  neutral: (axis) => `Neutral position in ${axis} — no advantage or gap`,
  green: (axis) => `Advantage in ${axis} — leverage this position`,
}

const ZONE_DIRECTIVES: Record<StrategicZone['zone'], (axis: string) => string> = {
  red: (axis) => `Invest heavily in ${axis} or pivot strategy`,
  saturated: (axis) => `Differentiate ${axis} approach rather than competing head-on`,
  neutral: (axis) => `Maintain ${axis} position and monitor`,
  green: (axis) => `Capitalize on ${axis} advantage — accelerate`,
}

export function fetchBenchmark(inputs: {
  messaging: MessagingAnalysis[] | null
  seo: SeoAcquisitionData | null
  social: SocialProfile[] | null
  content: ContentAnalysisData | null
  brandSocialScore?: number
  profile: AgentProfile
}): { scores: CompetitorScore[]; strategic_zones: StrategicZone[] } {
  const { messaging, seo, social, content, brandSocialScore, profile } = inputs

  const entities = [
    { name: profile.brand_name, isBrand: true },
    ...profile.competitors.map((c) => ({ name: c.name, isBrand: false })),
  ]

  const scores: CompetitorScore[] = entities.map((entity) => {
    const seoScore = deriveSeoScore(entity.name, seo, entity.isBrand)
    const productScore = deriveProductScore(entity.name, messaging, entity.isBrand)
    const socialScore = deriveSocialScore(entity.name, social, brandSocialScore, entity.isBrand)
    const contentScore = deriveContentScore(entity.name, content, entity.isBrand)
    const positioningScore = derivePositioningScore(entity.name, messaging, entity.isBrand)

    const globalScore = Math.round(
      seoScore * DIMENSION_WEIGHTS.seo +
        productScore * DIMENSION_WEIGHTS.product +
        socialScore * DIMENSION_WEIGHTS.social +
        contentScore * DIMENSION_WEIGHTS.content +
        positioningScore * DIMENSION_WEIGHTS.positioning,
    )

    return {
      entity: entity.name,
      is_client: entity.isBrand,
      seo_score: seoScore,
      product_score: productScore,
      social_score: socialScore,
      content_score: contentScore,
      positioning_score: positioningScore,
      global_score: globalScore,
      level: getLevel(globalScore),
    }
  })

  // Strategic zones — compare brand vs avg competitors per axis
  const brandScore = scores.find((s) => s.is_client)
  const compScores = scores.filter((s) => !s.is_client)

  const avgByAxis = (accessor: (s: CompetitorScore) => number): number => {
    if (compScores.length === 0) return 50
    return Math.round(compScores.reduce((sum, s) => sum + accessor(s), 0) / compScores.length)
  }

  const axisAccessors: Record<string, (s: CompetitorScore) => number> = {
    seo: (s) => s.seo_score,
    product: (s) => s.product_score,
    social: (s) => s.social_score,
    content: (s) => s.content_score,
    paid: () => 50, // no paid data yet
    youtube: (s) => s.content_score, // proxy from content
  }

  const brandAxisScores: Record<string, number> = {
    seo: brandScore?.seo_score ?? 50,
    product: brandScore?.product_score ?? 50,
    social: brandScore?.social_score ?? 50,
    content: brandScore?.content_score ?? 50,
    paid: 50,
    youtube: brandScore?.content_score ?? 50,
  }

  const strategic_zones: StrategicZone[] = ZONE_AXES.map((axis) => {
    const brandAxisScore = brandAxisScores[axis] ?? 50
    const avgComp = avgByAxis(axisAccessors[axis] ?? (() => 50))
    const zone = classifyZone(brandAxisScore, avgComp)

    return {
      axis,
      zone,
      description: ZONE_DESCRIPTIONS[zone](axis),
      directive: ZONE_DIRECTIVES[zone](axis),
    }
  })

  return { scores, strategic_zones }
}
