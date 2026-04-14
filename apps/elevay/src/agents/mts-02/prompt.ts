import type { AgentProfile } from '@/agents/_shared/types'
import { sanitize } from '@/agents/_shared/utils'
import type { MtsSessionContext, SynthesisData } from './types'

export function getSystemPrompt(language: string): string {
  return `CRITICAL: You MUST respond ENTIRELY in ${language}. Every field value must be in ${language}. Never use French if language is English. Use "months" not "mois", "weeks" not "semaines".

You are an expert Market Trend Strategist. Analyse the provided data and return JSON:

{
  "trending_topics": [
    {
      "topic": "keyword or topic name",
      "opportunity_score": 75,
      "growth_4w": 25,
      "best_channel": "SEO",
      "classification": "strong_trend",
      "source_confirmation": ["google_trends", "youtube"],
      "estimated_horizon": "1-3 months",
      "suggested_angle": "Specific content angle to pursue"
    }
  ],
  "saturated_topics": [
    {"topic": "topic name", "reason": "Why this is saturated"}
  ],
  "differentiating_angles": ["angle 1", "angle 2", "angle 3"],
  "roadmap_30d": [
    {"week": 1, "canal": "SEO", "format": "Long-form article", "suggested_title": "Concrete catchy title", "topic": "related topic", "priority": "high", "objective": "SEO"},
    {"week": 1, "canal": "LinkedIn", "format": "Carousel", "suggested_title": "Concrete catchy title", "topic": "related topic", "priority": "high", "objective": "lead_gen"},
    {"week": 2, "canal": "SEO", "format": "Article", "suggested_title": "Concrete catchy title", "topic": "related topic", "priority": "high", "objective": "SEO"},
    {"week": 2, "canal": "LinkedIn", "format": "Post", "suggested_title": "Concrete catchy title", "topic": "related topic", "priority": "medium", "objective": "branding"},
    {"week": 3, "canal": "LinkedIn", "format": "Carousel", "suggested_title": "Concrete catchy title", "topic": "related topic", "priority": "medium", "objective": "lead_gen"},
    {"week": 3, "canal": "YouTube", "format": "Tutorial", "suggested_title": "Concrete catchy title", "topic": "related topic", "priority": "medium", "objective": "activation"},
    {"week": 4, "canal": "SEO", "format": "Article", "suggested_title": "Concrete catchy title", "topic": "related topic", "priority": "medium", "objective": "SEO"},
    {"week": 4, "canal": "LinkedIn", "format": "Short video", "suggested_title": "Concrete catchy title", "topic": "related topic", "priority": "low", "objective": "activation"}
  ]
}

MANDATORY RULES:
- Return ONLY the JSON object. No markdown fences. No text before or after.
- trending_topics MUST have at least 3 items.
- roadmap_30d MUST have at least 8 items (2 per week, all 4 weeks). NEVER return empty.
- suggested_title must be a real, specific, catchy title based on actual trends found.
- estimated_horizon must use English: "< 2 weeks", "1-3 months", "3-6 months" — NEVER "mois" or "semaines".
- classification must be: "strong_trend", "buzz", "weak_signal", or "saturation".
- ALL text in ${language}.`
}

export function buildConsolidatedPrompt(
  profile: AgentProfile,
  context: MtsSessionContext,
  synthesis: SynthesisData,
  globalScore: number,
): string {
  const lang =
    profile.language === 'fr'
      ? 'French'
      : profile.language === 'en'
        ? 'English'
        : profile.language

  const topTrending = synthesis.trending_topics
    .sort((a, b) => b.opportunity_score - a.opportunity_score)
    .slice(0, 8)

  return `## Market Trend Analysis — ${sanitize(profile.brand_name)}

**Language for your response: ${lang}**

### Brand Profile
- Name: ${sanitize(profile.brand_name)}
- Sector: ${sanitize(context.sector)}
- Country: ${sanitize(profile.country)}
- Primary keyword: ${sanitize(profile.primary_keyword)}
- Secondary keyword: ${sanitize(profile.secondary_keyword)}
- Competitors: ${profile.competitors.map((c) => sanitize(c.name)).join(', ')}

### Priority Channels (IMPORTANT — roadmap must cover these)
${context.priority_channels.map((c) => `- ${c}`).join('\n')}

### Global Opportunity Score: ${globalScore}/100

### Preliminary Trending Topics (from data analysis)
${
  topTrending.length > 0
    ? topTrending
        .map(
          (t) =>
            `- "${t.topic}" | score: ${t.opportunity_score} | classification: ${t.classification} | sources: ${t.source_confirmation.join(', ')}`,
        )
        .join('\n')
    : '- No trending topics detected from data'
}

### Preliminary Saturated Topics
${
  synthesis.saturated_topics.length > 0
    ? synthesis.saturated_topics.map((t) => `- "${t.topic}": ${t.reason}`).join('\n')
    : '- None detected'
}

### Content Gaps (brand absent from SERP)
${
  synthesis.content_gap_map.length > 0
    ? synthesis.content_gap_map
        .slice(0, 5)
        .map((g) => `- "${g.keyword}" (volume: ${g.search_volume})`)
        .join('\n')
    : '- No gaps detected'
}

### Format Matrix
${synthesis.format_matrix.map((f) => `- ${f.channel}: ${f.dominant_formats.join(', ')}`).join('\n')}

### Social Signals
${
  synthesis.social_signals.length > 0
    ? synthesis.social_signals
        .slice(0, 5)
        .map((s) => `- [${s.platform}] ${s.signal} (${s.engagement_indicator})`)
        .join('\n')
    : '- No social signals detected'
}

---
Based on this data, produce:
1. An enriched list of trending topics (refine classifications, add suggested angles)
2. Final saturated topics list
3. 3-5 differentiating angles specific to ${sanitize(profile.brand_name)}
4. A 30-day roadmap: **mandatory** at least 1 entry per week (1-4) for each priority channel: ${context.priority_channels.join(', ')}

Respond in ${lang}.`
}
