// ─── Public output types ────────────────────────────────────────────────────

export interface TrendingTopic {
  topic: string
  opportunity_score: number // 0-100
  growth_4w: number // % growth over 4 weeks
  best_channel: string // "SEO" | "LinkedIn" | ...
  classification: 'weak_signal' | 'strong_trend' | 'saturation' | 'buzz'
  source_confirmation: string[] // ["google_trends", "youtube", ...]
  estimated_horizon: string // "< 2 semaines" | "1-3 mois" | ...
  suggested_angle: string
}

export interface SaturatedTopic {
  topic: string
  reason: string
}

export interface ContentGap {
  keyword: string
  search_volume: number
  competition: 'low' | 'medium' | 'high'
  opportunity: string
}

export interface FormatEntry {
  channel: string
  dominant_formats: string[] // ["carousel", "article", "short"]
  avg_engagement: string
}

export interface SocialSignal {
  platform: string
  signal: string
  engagement_indicator: 'high' | 'medium' | 'low'
}

export interface RoadmapEntry {
  week: 1 | 2 | 3 | 4
  canal: string
  format: string // "Article SEO" | "Carousel LinkedIn" | ...
  suggested_title: string
  topic: string
  priority: 'high' | 'medium' | 'low'
  objective: 'SEO' | 'lead_gen' | 'branding' | 'activation'
}

export interface MtsSessionContext {
  sector: string
  priority_channels: Array<
    'SEO' | 'LinkedIn' | 'YouTube' | 'TikTok' | 'Instagram' | 'Facebook' | 'X' | 'Press'
  >
}

export interface MtsPreviousComparison {
  date: string
  global_score: number
  trending_topics: string[]
  saturated_topics: string[]
}

export interface MtsOutput {
  global_score: number // 0-100 — global sector opportunity
  sector: string
  analysis_period: string // "30 jours"
  mode: 'ponctuel' | 'récurrent'
  session_context: MtsSessionContext
  trending_topics: TrendingTopic[]
  saturated_topics: SaturatedTopic[]
  content_gap_map: ContentGap[]
  format_matrix: FormatEntry[]
  social_signals: SocialSignal[]
  differentiating_angles: string[] // 3-5 LLM angles
  roadmap_30d: RoadmapEntry[] // ≥1 entry/week/channel
  opportunity_scores: Record<string, number> // topic → score (O(1) access)
  previous?: MtsPreviousComparison
}

// ─── Internal module types ───────────────────────────────────────────────────

export interface TrendsData {
  keywords: Array<{ term: string; volume: number; trend_direction: 'up' | 'stable' | 'down' }>
  rising_queries: string[]
  top_pages: string[]
}

export interface ContentData {
  top_serp_results: Array<{ keyword: string; titles: string[]; domains: string[] }>
  youtube_videos: Array<{ keyword: string; titles: string[]; views: number[] }>
  content_gaps: string[]
}

export interface CompetitiveContentData {
  competitors: Array<{
    name: string
    publishing_frequency: string // "3x/semaine" | "1x/mois" | ...
    content_themes: string[]
    has_youtube: boolean
    has_lead_magnets: boolean
  }>
}

export interface SocialSignalsData {
  signals: Array<{
    platform: string
    signal: string
    engagement_indicator: 'high' | 'medium' | 'low'
  }>
}

export interface SynthesisData {
  trending_topics: TrendingTopic[]
  saturated_topics: SaturatedTopic[]
  content_gap_map: ContentGap[]
  format_matrix: FormatEntry[]
  social_signals: SocialSignal[]
  opportunity_scores: Record<string, number>
}
