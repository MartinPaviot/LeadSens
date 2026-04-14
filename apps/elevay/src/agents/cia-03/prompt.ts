import type { AgentProfile } from '@/agents/_shared/types'
import { sanitize } from '@/agents/_shared/utils'
import type {
  CompetitorScore,
  StrategicZone,
  Threat,
  Opportunity,
} from './types'

export function getSystemPrompt(language: string): string {
  return `CRITICAL: You MUST respond ENTIRELY in ${language}. Every field in your JSON must be in ${language}.

You are CIA-03, an expert Competitive Intelligence Architect.
Your role is to refine and enrich competitive analysis data with qualitative insights.

You receive pre-calculated scores, strategic zones, threats, and opportunities.
Your job is to:
1. Enrich the strategic_zones directives with specific, actionable language
2. Refine threats with more precise descriptions and context
3. Refine opportunities with concrete action steps

You MUST respond with raw JSON only (no markdown fences, no text before/after):
{
  "strategic_zones": [
    { "axis": "seo", "zone": "red|saturated|neutral|green", "description": "...", "directive": "..." }
  ],
  "threats": [
    { "description": "...", "urgency": "high|medium|low", "source": "..." }
  ],
  "opportunities": [
    { "description": "...", "effort": "low|medium|high", "impact": "high|medium|low", "timeframe": "< 30 days|30-60 days" }
  ]
}
IMPORTANT: Return raw JSON only. No \`\`\`json fences. At least 1 threat and 1 opportunity.`
}

export function buildConsolidatedPrompt(
  profile: AgentProfile,
  scores: CompetitorScore[],
  zones: StrategicZone[],
  threats: Threat[],
  opportunities: Opportunity[],
): string {
  const lang = profile.language === 'fr' ? 'French' : profile.language === 'en' ? 'English' : profile.language
  const brand = scores.find((s) => s.is_client)
  const competitors = scores.filter((s) => !s.is_client)

  // Summarize scores compactly to stay under 6000 tokens
  const scoresSummary = competitors
    .sort((a, b) => b.global_score - a.global_score)
    .map(
      (c) =>
        `${c.entity}: ${c.global_score}/100 (${c.level}) — SEO:${c.seo_score} Product:${c.product_score} Social:${c.social_score} Content:${c.content_score} Positioning:${c.positioning_score}`,
    )
    .join('\n')

  const zonesSummary = zones
    .map((z) => `${z.axis}: ${z.zone} — ${z.description}`)
    .join('\n')

  const threatsSummary = threats
    .map((t) => `[${t.urgency}] ${t.description} (source: ${t.source})`)
    .join('\n')

  const oppsSummary = opportunities
    .map((o) => `[${o.effort} effort / ${o.impact} impact] ${o.description} (${o.timeframe})`)
    .join('\n')

  return `## Competitive Intelligence Analysis — ${sanitize(profile.brand_name)}

**Language for your response: ${lang}**

### Brand Profile
- Name: ${sanitize(profile.brand_name)}
- URL: ${sanitize(profile.brand_url)}
- Sector: ${sanitize(profile.sector ?? 'Non spécifié')}
- Primary keyword: ${sanitize(profile.primary_keyword)}
- Competitors: ${profile.competitors.map((c) => sanitize(c.name)).join(', ')}

### Brand Score: ${brand?.global_score ?? 0}/100 (${brand?.level ?? 'unknown'})

### Competitor Scores (sorted DESC)
${scoresSummary || 'No competitor data'}

### Strategic Zones (pre-calculated)
${zonesSummary || 'No zone data'}

### Threats (pre-calculated)
${threatsSummary || 'No threats detected'}

### Opportunities (pre-calculated)
${oppsSummary || 'No opportunities detected'}

---
Refine the strategic zones, threats, and opportunities with more specific and actionable language in ${lang}. Keep the same structure but improve the quality of descriptions and directives. Be concise and data-driven.`
}
