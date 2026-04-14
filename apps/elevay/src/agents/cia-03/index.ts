import { callLLM } from '@/agents/_shared/llm'
import type { AgentProfile, AgentOutput } from '@/agents/_shared/types'
import { fetchProductMessaging } from './modules/product-messaging'
import { fetchSeoAcquisition } from './modules/seo-acquisition'
import { fetchSocialMedia } from './modules/social-media'
import { fetchContentAnalysis } from './modules/content'
import { fetchBenchmark } from './modules/benchmark'
import { buildRecommendations } from './modules/recommendations'
import { getSystemPrompt, buildConsolidatedPrompt } from './prompt'
import type {
  CiaOutput,
  CiaSessionContext,
  StrategicZone,
  Threat,
  Opportunity,
} from './types'

interface LlmCiaResponse {
  strategic_zones: StrategicZone[]
  threats: Threat[]
  opportunities: Opportunity[]
}

function isLlmCiaResponse(v: unknown): v is LlmCiaResponse {
  if (!v || typeof v !== 'object') return false
  const obj = v as Record<string, unknown>
  return (
    Array.isArray(obj['strategic_zones']) &&
    Array.isArray(obj['threats']) &&
    Array.isArray(obj['opportunities'])
  )
}

export async function runCia03(
  profile: AgentProfile,
  context: CiaSessionContext,
  brandSocialScore?: number,
): Promise<AgentOutput<CiaOutput>> {
  // Phase 1 — 4 modules in parallel
  const [messagingResult, seoResult, socialResult, contentResult] =
    await Promise.allSettled([
      fetchProductMessaging(profile),
      fetchSeoAcquisition(profile),
      fetchSocialMedia(profile),
      fetchContentAnalysis(profile),
    ])

  const messaging =
    messagingResult.status === 'fulfilled' ? messagingResult.value.data : null
  const seo =
    seoResult.status === 'fulfilled' ? seoResult.value.data : null
  const social =
    socialResult.status === 'fulfilled' ? socialResult.value.data : null
  const content =
    contentResult.status === 'fulfilled' ? contentResult.value.data : null

  const degradedSources: string[] = []
  if (messagingResult.status === 'fulfilled' && !messagingResult.value.success)
    degradedSources.push('product-messaging')
  if (messagingResult.status === 'rejected') degradedSources.push('product-messaging')
  if (seoResult.status === 'fulfilled' && !seoResult.value.success)
    degradedSources.push('seo-acquisition')
  if (seoResult.status === 'rejected') degradedSources.push('seo-acquisition')
  if (socialResult.status === 'fulfilled' && !socialResult.value.success)
    degradedSources.push('social-media')
  if (socialResult.status === 'rejected') degradedSources.push('social-media')
  if (contentResult.status === 'fulfilled' && !contentResult.value.success)
    degradedSources.push('content')
  if (contentResult.status === 'rejected') degradedSources.push('content')

  // Phase 2 — Benchmark (pure calculation)
  const { scores, strategic_zones } = fetchBenchmark({
    messaging,
    seo,
    social,
    content,
    brandSocialScore,
    profile,
  })

  // Phase 2b — Recommendations (pure calculation)
  const { threats, opportunities, action_plan_60d } = buildRecommendations({
    scores,
    zones: strategic_zones,
    content,
    seo,
    context,
  })

  // Phase 3 — LLM refinement
  const llmResponse = await callLLM({
    system: getSystemPrompt(profile.language ?? 'English'),
    user: buildConsolidatedPrompt(profile, scores, strategic_zones, threats, opportunities),
    maxTokens: 4096,
    temperature: 0.3,
  })

  // Merge LLM enrichments if parseable
  let finalZones = strategic_zones
  let finalThreats = threats
  let finalOpportunities = opportunities

  if (isLlmCiaResponse(llmResponse.parsed)) {
    const refined = llmResponse.parsed
    // Merge LLM zones — keep axis/zone, update description/directive
    if (refined.strategic_zones.length > 0) {
      finalZones = strategic_zones.map((original) => {
        const llmZone = refined.strategic_zones.find((z) => z.axis === original.axis)
        if (llmZone) {
          return {
            ...original,
            description: llmZone.description || original.description,
            directive: llmZone.directive || original.directive,
          }
        }
        return original
      })
    }
    if (refined.threats.length > 0) finalThreats = refined.threats
    if (refined.opportunities.length > 0) finalOpportunities = refined.opportunities
  }

  const brandScore = scores.find((s) => s.is_client)

  const payload: CiaOutput = {
    brand_score: brandScore?.global_score ?? 0,
    analysis_date: new Date().toISOString(),
    analysis_context: context,
    competitor_scores: scores,
    strategic_zones: finalZones,
    product_messaging: messaging ?? [],
    seo_data: seo ?? {
      brand_seo: {
        domain: profile.brand_url,
        domain_authority: null,
        organic_traffic_estimate: null,
        top_keywords: [],
      },
      competitors_seo: [],
    },
    social_matrix: social ?? [],
    content_gap_map: content?.content_gap_map ?? [],
    content_competitors: content?.competitors_content ?? [],
    threats: finalThreats,
    opportunities: finalOpportunities,
    action_plan_60d,
  }

  return {
    agent_code: 'CIA-03',
    analysis_date: new Date().toISOString(),
    brand_profile: profile,
    payload,
    degraded_sources: degradedSources,
    version: '1.0',
  }
}
