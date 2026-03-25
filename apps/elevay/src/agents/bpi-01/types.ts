// ── Sub-types (non définis explicitement dans la spec, inférés du contexte) ────

export interface VideoEntry {
  title: string
  channel: string
  views: number
  date: string // ISO 8601
  url: string
  sentiment?: 'positive' | 'neutral' | 'negative'
}

export interface PlatformData {
  platform: 'linkedin' | 'instagram' | 'twitter' | 'tiktok'
  followers: number
  engagement_rate: number // pourcentage 0-100
  post_frequency: string  // ex: "3x/semaine"
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'
  status: 'active' | 'inactive' | 'missing'
}

export interface CompetitorSeoData {
  competitor: string
  domain_authority: number
  keyword_positions: Record<string, number | null>
  seo_score: number
}

export interface CompetitorRadarEntry {
  name: string
  serp_share: number    // 0-100
  press_volume: number  // 0-100
  seo_score: number     // 0-100
  youtube_reach: number // 0-100
  social_score: number  // 0-100
}

export interface ReviewData {
  rating: number       // 0-5
  review_count: number
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'
}

export interface SentimentData {
  positive: number
  neutral: number
  negative: number
  dominant: string
}

export interface GoogleMapsData {
  found: boolean
  place_id?: string
  name?: string
  rating?: number
  review_count?: number
  sentiment?: SentimentData
  reputation_score?: number
  top_positive_reviews?: string[]  // 3 max
  top_negative_reviews?: string[]  // 3 max
  degraded: boolean
}

// ── Module output interfaces — section 3 agentBPI-01.md ────────────────────────

export interface SerpData {
  official_site_position: number | null
  negative_snippets: string[]
  competitor_positions: Record<string, number | null>
  visibility_score: number  // 0-100
  reputation_score: number  // 0-100
}

export interface PressData {
  article_count: number
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'
  editorial_angle: string
  top_domains: string[]
  pr_opportunities: string[]
}

export interface YoutubeData {
  video_count: number
  top_videos: VideoEntry[]
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'
  influencer_opportunities: string[]
  reputation_score: number // 0-100
}

export interface SocialData {
  platforms: PlatformData[]
  social_score: number           // 0-100
  brand_coherence_score: number  // 0-100
  dominant_topics: string[]
}

export interface SeoData {
  keyword_positions: Record<string, number | null>
  domain_authority: number
  backlink_count: number
  competitor_comparison: CompetitorSeoData[]
  keyword_gaps: string[]
  seo_score: number    // 0-100
  cached_at?: string   // ISO 8601 — présent si données depuis cache
}

export interface BenchmarkData {
  competitive_score: number  // 0-100
  radar: CompetitorRadarEntry[]
  google_maps: ReviewData | null
  trustpilot: ReviewData | null
}

// ── BpiOutput — section 6 agentBPI-01.md ──────────────────────────────────────

export interface Risk {
  description: string
  urgency: 'high' | 'medium' | 'low'
  source: string
}

export interface QuickWin {
  action: string
  impact: 'high' | 'medium' | 'low'
  effort: 'low' | 'medium' | 'high'
  estimated_time: string
}

export interface RoadmapPhase {
  phase: 1 | 2 | 3
  label: string
  objective: string
  actions: string[]
}

export interface BpiOutput {
  scores: {
    global: number
    reputation: number
    visibility: number
    social: number
    competitive: number
    previous?: {
      global: number
      reputation: number
      visibility: number
      social: number
      competitive: number
      date: string
    }
  }
  serp_data: SerpData | null
  seo_data: SeoData | null
  press_data: PressData | null
  youtube_data: YoutubeData | null
  social_data: SocialData | null
  benchmark_data: BenchmarkData | null
  googleMapsReputation?: GoogleMapsData
  top_risks: Risk[]
  quick_wins: QuickWin[]
  roadmap_90d: RoadmapPhase[]
}
