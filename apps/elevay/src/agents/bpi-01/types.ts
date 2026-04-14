export interface SerpData {
  official_site_position: number | null
  negative_snippets: string[]
  competitor_positions: Record<string, number | null>
  visibility_score: number // 0-100
  reputation_score: number // 0-100
}

export interface PressData {
  article_count: number
  sentiment: "positive" | "neutral" | "negative" | "mixed"
  editorial_angle: string
  top_domains: string[]
  pr_opportunities: string[]
}

export interface YoutubeData {
  video_count: number
  top_videos: Array<{ title: string; views: number; channel: string }>
  sentiment: "positive" | "neutral" | "negative" | "mixed"
  influencer_opportunities: string[]
  reputation_score: number // 0-100
}

export interface SocialData {
  platforms: Array<{
    platform: string // "linkedin" | "instagram" | "twitter" | "tiktok"
    followers: number | null
    engagement_rate: number | null
    posting_frequency: string
  }>
  social_score: number // 0-100
  brand_coherence_score: number
  dominant_topics: string[]
  scored_platforms: string[]
}

export interface SeoData {
  keyword_positions: Record<string, number | null>
  domain_authority: number
  backlink_count: number
  competitor_comparison: Array<{ competitor: string; da: number }>
  keyword_gaps: string[]
  seo_score: number // 0-100
  cached_at?: string // ISO 8601 — present if from cache
}

export interface BenchmarkData {
  competitors: Array<{
    name: string
    overall_score: number
    dimensions: Record<string, number>
  }>
  brand_rank: number
  benchmark_score: number // 0-100
}

export interface GoogleMapsData {
  rating: number | null
  review_count: number
  recent_sentiment: "positive" | "neutral" | "negative" | "mixed"
}

export interface TrustpilotData {
  rating: number | null
  review_count: number
  trust_score: number // 0-100
}

export interface AxisDiagnostic {
  axis: "serp" | "press" | "youtube" | "social" | "seo" | "benchmark"
  diagnostic: string
}

export interface Priority90d {
  action: string
  tag: "Urgent" | "Mid-term" | "Quick win"
  source_problem: string
}

export interface BpiScores {
  global: number
  serp: number
  press: number
  youtube: number
  social: number
  seo: number
  benchmark: number
  completeness: number // % of available sources
  previous?: {
    global: number
    serp: number
    press: number
    youtube: number
    social: number
    seo: number
    benchmark: number
    date: string
  }
}

export interface BpiOutput {
  scores: BpiScores
  serp_data: SerpData | null
  press_data: PressData | null
  youtube_data: YoutubeData | null
  social_data: SocialData | null
  seo_data: SeoData | null
  benchmark_data: BenchmarkData | null
  googleMapsReputation: GoogleMapsData | null
  trustpilot: TrustpilotData | null
  axis_diagnostics: AxisDiagnostic[]
  priorities_90d: Priority90d[]
  warning?: string
}
