import { callLLM } from '@/agents/_shared/llm'
import type { AgentProfile, AgentOutput } from '@/agents/_shared/types'
import { fetchTrends } from './modules/trends'
import { fetchContent } from './modules/content'
import { fetchCompetitive } from './modules/competitive'
import { fetchSocialListening } from './modules/social-listening'
import { runSynthesis } from './modules/synthesis'
import { calculateMtsScore } from './scoring'
import { getSystemPrompt, buildConsolidatedPrompt } from './prompt'
import type {
  MtsOutput,
  MtsSessionContext,
  TrendingTopic,
  SaturatedTopic,
  RoadmapEntry,
} from './types'

interface LlmMtsResponse {
  trending_topics: TrendingTopic[]
  saturated_topics: SaturatedTopic[]
  differentiating_angles: string[]
  roadmap_30d: RoadmapEntry[]
}

function isLlmMtsResponse(v: unknown): v is LlmMtsResponse {
  if (!v || typeof v !== 'object') return false
  const obj = v as Record<string, unknown>
  return (
    Array.isArray(obj['trending_topics']) &&
    Array.isArray(obj['saturated_topics']) &&
    Array.isArray(obj['differentiating_angles']) &&
    Array.isArray(obj['roadmap_30d'])
  )
}

export async function runMts02(
  profile: AgentProfile,
  context: MtsSessionContext,
): Promise<AgentOutput<MtsOutput>> {
  const degradedSources: string[] = []

  // ── Phase 1: Parallel ──────────────────────────────────────────────────────
  const [trendsResult, competitiveResult, socialResult] = await Promise.allSettled([
    fetchTrends(profile),
    fetchCompetitive(profile),
    fetchSocialListening(profile),
  ])

  const trendsModule =
    trendsResult.status === 'fulfilled' ? trendsResult.value : null
  const competitiveModule =
    competitiveResult.status === 'fulfilled' ? competitiveResult.value : null
  const socialModule =
    socialResult.status === 'fulfilled' ? socialResult.value : null

  const trends = trendsModule?.success ? trendsModule.data : null
  const competitive = competitiveModule?.success ? competitiveModule.data : null
  const social = socialModule?.success ? socialModule.data : null

  if (!trends) degradedSources.push('trends')
  if (!competitive) degradedSources.push('competitive')
  if (!social) degradedSources.push('social-listening')

  // ── Phase 2: Sequential — fetchContent depends on TrendsData ──────────────
  const contentResult = await fetchContent(profile, trends)
  const content = contentResult.success ? contentResult.data : null
  if (!content) degradedSources.push('content')

  // ── Phase 3: Pure synthesis (zero API) ────────────────────────────────────
  const synthesis = runSynthesis({ trends, content, competitive, social, profile })

  // ── Score ─────────────────────────────────────────────────────────────────
  const globalScore = calculateMtsScore(synthesis)

  // ── Phase 4: Single LLM call ──────────────────────────────────────────────
  const llmResponse = await callLLM({
    system: getSystemPrompt(profile.language ?? 'English'),
    user: buildConsolidatedPrompt(profile, context, synthesis, globalScore),
    maxTokens: 4096,
    temperature: 0.4,
  })

  // Parse LLM output
  let trendingTopics = synthesis.trending_topics
  let saturatedTopics = synthesis.saturated_topics
  let differentiatingAngles: string[] = []
  let roadmap30d: RoadmapEntry[] = []
  let warning: string | undefined
  if (isLlmMtsResponse(llmResponse.parsed)) {
    trendingTopics = llmResponse.parsed.trending_topics
    saturatedTopics = llmResponse.parsed.saturated_topics
    differentiatingAngles = llmResponse.parsed.differentiating_angles
    roadmap30d = llmResponse.parsed.roadmap_30d
  } else {
    warning = 'AI analysis returned partial results — some trends may be from pre-computed data only'
  }

  // Build opportunity scores map (O(1) access in UI)
  const opportunityScores: Record<string, number> = {}
  for (const t of trendingTopics) {
    opportunityScores[t.topic] = t.opportunity_score
  }

  const payload: MtsOutput = {
    global_score: globalScore,
    sector: context.sector,
    analysis_period: '30 jours',
    mode: 'ponctuel',
    session_context: context,
    trending_topics: trendingTopics,
    saturated_topics: saturatedTopics,
    content_gap_map: synthesis.content_gap_map,
    format_matrix: synthesis.format_matrix,
    social_signals: synthesis.social_signals,
    differentiating_angles: differentiatingAngles,
    roadmap_30d: roadmap30d,
    opportunity_scores: opportunityScores,
    warning,
  }

  return {
    agent_code: 'MTS-02',
    analysis_date: new Date().toISOString(),
    brand_profile: profile,
    payload,
    degraded_sources: degradedSources,
    version: '1.0',
  }
}
