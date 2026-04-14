import type {
  CompetitorScore,
  StrategicZone,
  ContentAnalysisData,
  SeoAcquisitionData,
  CiaSessionContext,
  Threat,
  Opportunity,
  ActionPhase,
} from '../types'

function buildThreats(
  scores: CompetitorScore[],
  zones: StrategicZone[],
  seo: SeoAcquisitionData | null,
): Threat[] {
  const threats: Threat[] = []
  const dominantCompetitors = scores.filter((s) => !s.is_client && s.level === 'dominant')
  const redZones = zones.filter((z) => z.zone === 'red')

  // High urgency: red zone + dominant competitor
  for (const zone of redZones) {
    const hasDominant = dominantCompetitors.length > 0
    threats.push({
      description: `Red zone in ${zone.axis} — ${hasDominant ? `dominant competitor detected (${dominantCompetitors[0]?.entity})` : 'significant gap'}`,
      urgency: hasDominant ? 'high' : 'medium',
      source: zone.axis,
    })
  }

  // Medium urgency: strong competitors in saturated zones
  const saturatedZones = zones.filter((z) => z.zone === 'saturated')
  const strongCompetitors = scores.filter(
    (s) => !s.is_client && (s.level === 'strong' || s.level === 'dominant'),
  )
  for (const zone of saturatedZones) {
    if (strongCompetitors.length > 0) {
      threats.push({
        description: `${zone.axis} axis saturated with ${strongCompetitors.length} strong competitor(s)`,
        urgency: 'medium',
        source: zone.axis,
      })
    }
  }

  // SEO-specific threats
  if (seo) {
    const highOverlap = seo.competitors_seo.filter((c) => c.keyword_overlap > 60)
    if (highOverlap.length > 0) {
      threats.push({
        description: `High keyword overlap with ${highOverlap.length} competitor(s) — SEO cannibalization risk`,
        urgency: 'medium',
        source: 'seo',
      })
    }
  }

  // Low urgency: any competitor stronger than brand
  const brand = scores.find((s) => s.is_client)
  if (brand) {
    const stronger = scores.filter(
      (s) => !s.is_client && s.global_score > brand.global_score + 10,
    )
    if (stronger.length > 0 && threats.length === 0) {
      threats.push({
        description: `${stronger.length} competitor(s) with a global score 10+ points higher`,
        urgency: 'low',
        source: 'benchmark',
      })
    }
  }

  return threats
}

function buildOpportunities(
  scores: CompetitorScore[],
  zones: StrategicZone[],
  content: ContentAnalysisData | null,
  context: CiaSessionContext,
): Opportunity[] {
  const opportunities: Opportunity[] = []
  const greenZones = zones.filter((z) => z.zone === 'green')

  // Green zone + content gap = low effort opportunity
  for (const zone of greenZones) {
    const hasContentGap =
      content?.content_gap_map.some((g) => !g.brand_covered) ?? false

    opportunities.push({
      description: `Capitalize on ${zone.axis} advantage${hasContentGap ? ' — content gaps identified' : ''}`,
      effort: hasContentGap ? 'low' : 'medium',
      impact: 'high',
      timeframe: '< 30 days',
    })
  }

  // Content gaps as opportunities
  if (content) {
    const gaps = content.content_gap_map.filter((g) => !g.brand_covered)
    if (gaps.length > 0) {
      opportunities.push({
        description: `${gaps.length} uncovered keyword(s) — create targeted content`,
        effort: 'medium',
        impact: 'high',
        timeframe: '< 30 days',
      })
    }
  }

  // Weak competitors = opportunity to gain market share
  const weakCompetitors = scores.filter(
    (s) => !s.is_client && (s.level === 'vulnerable' || s.level === 'weak'),
  )
  if (weakCompetitors.length > 0) {
    opportunities.push({
      description: `${weakCompetitors.length} weak competitor(s) — opportunity to capture their audience`,
      effort: 'medium',
      impact: 'medium',
      timeframe: '30-60 days',
    })
  }

  // Channel-specific opportunities based on objective
  const neutralZones = zones.filter((z) => z.zone === 'neutral')
  for (const zone of neutralZones) {
    if (context.priority_channels.some((ch) => ch.toLowerCase() === zone.axis)) {
      opportunities.push({
        description: `${zone.axis} is neutral and a priority channel — invest to gain the edge`,
        effort: 'medium',
        impact: 'medium',
        timeframe: '30-60 days',
      })
    }
  }

  return opportunities
}

function buildActionPlan(
  threats: Threat[],
  opportunities: Opportunity[],
): ActionPhase[] {
  // Phase 1 (< 30j): high urgency threats + quick wins
  const phase1Actions: string[] = []
  const highThreats = threats.filter((t) => t.urgency === 'high')
  const quickWins = opportunities.filter(
    (o) => o.effort === 'low' && o.timeframe === '< 30 days',
  )

  for (const t of highThreats) {
    phase1Actions.push(`[DEFEND] ${t.description}`)
  }
  for (const o of quickWins) {
    phase1Actions.push(`[QUICK WIN] ${o.description}`)
  }
  // Add medium threats if few phase1 actions
  if (phase1Actions.length < 2) {
    const mediumThreats = threats.filter((t) => t.urgency === 'medium')
    for (const t of mediumThreats.slice(0, 2)) {
      phase1Actions.push(`[DEFEND] ${t.description}`)
    }
  }
  // Add short-term medium effort opps
  const shortTermMedium = opportunities.filter(
    (o) => o.effort === 'medium' && o.timeframe === '< 30 days',
  )
  for (const o of shortTermMedium) {
    phase1Actions.push(`[ACTION] ${o.description}`)
  }

  // Phase 2 (30-60j): medium effort opportunities + remaining threats
  const phase2Actions: string[] = []
  const mediumTermOpps = opportunities.filter((o) => o.timeframe === '30-60 days')
  for (const o of mediumTermOpps) {
    phase2Actions.push(`[ATTACK] ${o.description}`)
  }
  const lowThreats = threats.filter((t) => t.urgency === 'low')
  for (const t of lowThreats) {
    phase2Actions.push(`[MONITOR] ${t.description}`)
  }

  return [
    {
      phase: 1,
      label: 'Phase 1: Defense',
      objective: 'Address urgent threats and seize quick wins',
      actions: phase1Actions.length > 0 ? phase1Actions : ['No urgent action identified'],
    },
    {
      phase: 2,
      label: 'Phase 2: Attack',
      objective: 'Exploit opportunities and strengthen positions',
      actions: phase2Actions.length > 0 ? phase2Actions : ['Consolidate Phase 1 gains'],
    },
  ]
}

export function buildRecommendations(inputs: {
  scores: CompetitorScore[]
  zones: StrategicZone[]
  content: ContentAnalysisData | null
  seo: SeoAcquisitionData | null
  context: CiaSessionContext
}): { threats: Threat[]; opportunities: Opportunity[]; action_plan_60d: ActionPhase[] } {
  const { scores, zones, content, seo, context } = inputs

  const threats = buildThreats(scores, zones, seo)
  const opportunities = buildOpportunities(scores, zones, content, context)
  const action_plan_60d = buildActionPlan(threats, opportunities)

  return { threats, opportunities, action_plan_60d }
}
