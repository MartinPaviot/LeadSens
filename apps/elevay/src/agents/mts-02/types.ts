import type { ElevayAgentProfile } from "../_shared/types";

// ── Session context (posé au lancement, non persisté) ─────────────────────────

export interface MtsSessionContext {
  sector: string
  priority_channels: Array<"SEO" | "LinkedIn" | "YouTube" | "TikTok" | "Instagram" | "Facebook" | "X" | "Press">
}

// ── Module 1 — Trends ─────────────────────────────────────────────────────────

export interface KeywordTrend {
  keyword: string
  volume: number
  difficulty: number
  growth_30d: number  // % hausse sur 30j
  growth_90d: number  // % hausse sur 90j
}

export interface TrendsData {
  rising_keywords: KeywordTrend[]   // growth_30d > 30%
  stable_keywords: KeywordTrend[]   // ±10%
  declining_keywords: KeywordTrend[]
  press_themes: string[]
}

// ── Module 2 — Content ────────────────────────────────────────────────────────

export interface SerpContent {
  title: string
  url: string
  snippet: string
  position: number
}

export interface YoutubeContent {
  title: string
  channel: string
  videoId: string
  publishedAt: string
}

export interface SocialSample {
  platform: string
  text: string
  engagement: number
}

export interface ContentPerformanceData {
  serp_top_content: SerpContent[]
  youtube_trending: YoutubeContent[]
  social_samples: SocialSample[]
  dominant_formats: Record<string, string>  // canal → format dominant
  dominant_tones: Record<string, string>    // canal → ton dominant
}

// ── Module 3 — Competitive ────────────────────────────────────────────────────

export interface CompetitorContent {
  name: string
  url: string
  topics: string[]
  formats: string[]
  publication_frequency: "low" | "medium" | "high" | "unknown"
}

export interface ContentGap {
  topic: string
  estimated_volume: number
  competitor_coverage: "none" | "low" | "medium" | "high"
  opportunity_score: number  // 0-100
}

export interface CompetitiveContentData {
  competitor_content: CompetitorContent[]
  saturated_angles: string[]   // présents chez tous les concurrents
  missing_angles: string[]     // absents chez tous les concurrents
  content_gaps: ContentGap[]
}

// ── Module 4 — Social Listening ───────────────────────────────────────────────

export interface SocialSignal {
  platform: string
  dominant_format: string
  dominant_tone: string
  trending_hooks: string[]
  engagement_benchmark: number
  available: boolean  // false si plateforme indisponible
}

export interface SocialListeningData {
  linkedin_signals: SocialSignal[]
  tiktok_signals: SocialSignal[]
  x_signals: SocialSignal[]
}

// ── Output final MTS-02 (spec §5) ────────────────────────────────────────────

export interface TrendingTopic {
  topic: string
  opportunity_score: number
  growth_4w: number                // % croissance sur 4 semaines (≈30j)
  best_channel: string             // canal où la tendance est la plus forte
  classification: "weak_signal" | "strong_trend" | "saturation" | "buzz"
  source_confirmation: string[]    // sources confirmant la tendance
  estimated_horizon: string        // ex: "4-8 semaines"
  suggested_angle: string
}

export interface SaturatedTopic {
  topic: string
  reason: string
}

export interface RoadmapEntry {
  week: number         // 1 à 4
  canal: string
  format: string
  suggested_title: string
  topic: string
  priority: "high" | "medium" | "low"
  objective: "SEO" | "lead_gen" | "branding" | "activation"
}

export interface FormatEntry {
  canal: string
  dominant_format: string
  dominant_tone: string
  example: string
}

export type MtsMode = "ponctuel" | "récurrent"

export interface MtsPreviousComparison {
  date: string
  global_score: number
  trending_topics: string[]    // noms uniquement pour comparaison
  saturated_topics: string[]
}

export interface MtsOutput {
  // En-tête
  global_score: number
  sector: string
  analysis_period: string        // ex: "avril 2026"
  mode: MtsMode

  session_context: MtsSessionContext
  trending_topics: TrendingTopic[]
  saturated_topics: SaturatedTopic[]
  content_gap_map: ContentGap[]
  format_matrix: FormatEntry[]
  social_signals: SocialSignal[]
  differentiating_angles: string[]       // 3 max
  roadmap_30d: RoadmapEntry[]
  opportunity_scores: Record<string, number>  // topic → score

  // Comparaison historique (mode récurrent)
  previous?: MtsPreviousComparison
}

// ── Input ─────────────────────────────────────────────────────────────────────

export interface MtsInput {
  brand_profile: ElevayAgentProfile
  session_context: MtsSessionContext
}
