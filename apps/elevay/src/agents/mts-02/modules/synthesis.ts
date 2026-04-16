import type { AgentProfile } from '@/agents/_shared/types'
import type {
  TrendsData,
  ContentData,
  CompetitiveContentData,
  SocialSignalsData,
  SynthesisData,
  TrendingTopic,
  SaturatedTopic,
  ContentGap,
  FormatEntry,
  SocialSignal,
} from '../types'

// Pure calculation — zero API calls
export function runSynthesis(inputs: {
  trends: TrendsData | null
  content: ContentData | null
  competitive: CompetitiveContentData | null
  social: SocialSignalsData | null
  profile: AgentProfile
}): SynthesisData {
  const { trends, content, competitive, social, profile } = inputs

  // ── Trending topics ────────────────────────────────────────────────────────
  const trendingTopics: TrendingTopic[] = []
  const saturatedTopics: SaturatedTopic[] = []

  if (trends) {
    for (const kw of trends.keywords) {
      const sourceConfirmation: string[] = ['google_trends']

      // Check if also present in YouTube
      const inYoutube = content?.youtube_videos.some((v) => v.keyword === kw.term)
      if (inYoutube) sourceConfirmation.push('youtube')

      // Check if in social signals
      const inSocial = social?.signals.some((s) =>
        s.signal.toLowerCase().includes(kw.term.toLowerCase()),
      )
      if (inSocial) sourceConfirmation.push('social')

      // Check if in competitive content themes
      const inCompetitive = competitive?.competitors.some((c) =>
        c.content_themes.some((t) =>
          t.toLowerCase().includes(kw.term.toLowerCase()),
        ),
      )
      if (inCompetitive) sourceConfirmation.push('competitive')

      // Classify based on rules from design.md
      let classification: TrendingTopic['classification']
      const multiSource = sourceConfirmation.length >= 2

      if (kw.trend_direction === 'up' && multiSource) {
        classification = 'strong_trend'
      } else if (kw.trend_direction === 'up' && !multiSource) {
        // Check if SERP dominated (high competition → saturation)
        const serpEntry = content?.top_serp_results.find((r) => r.keyword === kw.term)
        const dominated = serpEntry && serpEntry.domains.length >= 3
        classification = dominated ? 'buzz' : 'weak_signal'
      } else if (kw.trend_direction === 'down') {
        saturatedTopics.push({
          topic: kw.term,
          reason: 'Declining volume — saturated or losing interest',
        })
        continue
      } else {
        classification = 'weak_signal'
      }

      // Opportunity score = (growth_4w * 0.4) + (competition_inverse * 0.3) + (multi_source_bonus * 0.3)
      const growth4w = kw.trend_direction === 'up' ? 60 : kw.trend_direction === 'stable' ? 20 : 0
      const serpEntry = content?.top_serp_results.find((r) => r.keyword === kw.term)
      const competitionInverse = serpEntry && serpEntry.domains.length >= 3 ? 20 : 70
      const multiSourceBonus = multiSource ? 80 : 20
      const opportunityScore = Math.round(
        growth4w * 0.4 + competitionInverse * 0.3 + multiSourceBonus * 0.3,
      )

      const bestChannel =
        (profile.priority_channels?.[0] as string | undefined) ??
        (inYoutube ? 'YouTube' : 'SEO')

      trendingTopics.push({
        topic: kw.term,
        opportunity_score: Math.min(100, opportunityScore),
        growth_4w: growth4w,
        best_channel: bestChannel,
        classification,
        source_confirmation: sourceConfirmation,
        estimated_horizon:
          classification === 'strong_trend'
            ? '1-3 months'
            : classification === 'buzz'
              ? '< 2 weeks'
              : '3-6 months',
        suggested_angle: `${profile.brand_name} approach on "${kw.term}"`,
      })
    }
  }

  // Also flag rising queries with no SERP coverage as saturation signals
  if (trends?.rising_queries) {
    for (const q of trends.rising_queries.slice(0, 3)) {
      const alreadyAdded = trendingTopics.some((t) => t.topic === q)
      if (!alreadyAdded) {
        trendingTopics.push({
          topic: q,
          opportunity_score: 50,
          growth_4w: 30,
          best_channel: 'SEO',
          classification: 'weak_signal',
          source_confirmation: ['rising_query'],
          estimated_horizon: '1-3 months',
          suggested_angle: `Content around "${q}"`,
        })
      }
    }
  }

  // ── Content gaps ───────────────────────────────────────────────────────────
  const contentGapMap: ContentGap[] = (content?.content_gaps ?? []).map((kw) => {
    const kwData = trends?.keywords.find((k) => k.term === kw)
    return {
      keyword: kw,
      search_volume: kwData?.volume ?? 0,
      competition: 'medium' as const,
      opportunity: `Gap identified — ${profile.brand_name} absent from top SERP for "${kw}"`,
    }
  })

  // ── Format matrix ─────────────────────────────────────────────────────────
  const formatMatrix: FormatEntry[] = []
  const channels = profile.priority_channels?.length
    ? profile.priority_channels
    : ['SEO', 'LinkedIn']

  for (const channel of channels.slice(0, 4)) {
    const formats =
      channel === 'SEO'
        ? ['Article long-form', 'Guide', 'FAQ']
        : channel === 'LinkedIn'
          ? ['Carousel', 'Article', 'Text post']
          : channel === 'YouTube'
            ? ['Tutorial', 'Short video', 'Interview']
            : channel === 'TikTok' || channel === 'Instagram'
              ? ['Short', 'Reel', 'Story']
              : ['Post', 'Article', 'Infographic']

    // Estimate engagement from competitive data
    const avgEngagement = competitive
      ? competitive.competitors.filter((c) => c.has_youtube).length >= 2
        ? 'High'
        : 'Medium'
      : 'Not measured'

    formatMatrix.push({
      channel,
      dominant_formats: formats,
      avg_engagement: avgEngagement,
    })
  }

  // ── Social signals ─────────────────────────────────────────────────────────
  const socialSignals: SocialSignal[] = (social?.signals ?? []).map((s) => ({
    platform: s.platform,
    signal: s.signal,
    engagement_indicator: s.engagement_indicator,
  }))

  // ── Opportunity scores map ─────────────────────────────────────────────────
  const opportunityScores: Record<string, number> = {}
  for (const t of trendingTopics) {
    opportunityScores[t.topic] = t.opportunity_score
  }

  return {
    trending_topics: trendingTopics,
    saturated_topics: saturatedTopics,
    content_gap_map: contentGapMap,
    format_matrix: formatMatrix,
    social_signals: socialSignals,
    opportunity_scores: opportunityScores,
  }
}
