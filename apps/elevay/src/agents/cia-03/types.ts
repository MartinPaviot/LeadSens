import type { ElevayAgentProfile } from "../_shared/types";

// ── Session context (posé au lancement, non persisté) ─────────────────────────

export interface CiaSessionContext {
  priority_channels: Array<"SEO" | "paid" | "social" | "product" | "global" | "LinkedIn" | "YouTube" | "TikTok" | "Instagram" | "Facebook" | "X" | "Press">
  objective: "lead_gen" | "acquisition" | "retention" | "branding"
}

// ── Module 1 — Produit & Messaging ────────────────────────────────────────────

export interface MessagingAnalysis {
  competitor_url: string
  hero_message: string
  value_prop: string
  primary_cta: string
  pricing_posture: "premium" | "mid-market" | "low-cost" | "freemium" | "unknown"
  dominant_angle: string  // ROI / simplicité / sécurité / émotion / authority
  messaging_clarity_score: number       // 0-100
  differentiation_score: number         // 0-100
  scraping_success: boolean
}

export interface ProductMessagingData {
  competitors: MessagingAnalysis[]
}

// ── Module 2 — SEO & Acquisition ──────────────────────────────────────────────

export interface SeoMetrics {
  entity_url: string
  domain_authority: number
  estimated_keywords: number
  estimated_traffic: number
  backlink_count: number
  serp_positions: Record<string, number | null>  // keyword → position
  has_google_ads: boolean
  featured_snippets: number
  seo_score: number     // 0-100 relatif au groupe analysé
  cached_at?: string    // ISO 8601 si depuis cache
}

export interface SeoAcquisitionData {
  brand_seo: SeoMetrics
  competitors_seo: SeoMetrics[]
}

// ── Module 3 — Social Media ───────────────────────────────────────────────────

export interface PlatformData {
  platform: string
  publication_frequency: string
  avg_engagement: number
  dominant_formats: string[]
  dominant_tone: string
  recurring_hooks: string[]
  available: boolean
}

export interface SocialProfile {
  competitor_url: string
  platforms: PlatformData[]
  social_score: number
}

export interface SocialMediaData {
  competitors: SocialProfile[]
}

// ── Module 4 — Contenu ────────────────────────────────────────────────────────

export interface ContentGap {
  angle: string
  competitor_coverage: "none" | "low" | "medium" | "high"
  opportunity: string
}

export interface CompetitorContent {
  competitor_url: string
  blog_frequency: string
  dominant_themes: string[]
  lead_magnet_types: string[]
  youtube_video_count: number
  youtube_dominant_angle: string | null
  content_score: number
}

export interface ContentAnalysisData {
  competitors: CompetitorContent[]
  editorial_gap_map: ContentGap[]
}

// ── Module 5 — Benchmark ─────────────────────────────────────────────────────

export interface CompetitorScore {
  entity: string
  is_client: boolean
  seo_score: number
  product_score: number
  social_score: number
  content_score: number
  positioning_score: number
  global_score: number
  level: "vulnerable" | "weak" | "competitive" | "strong" | "dominant"
}

export interface StrategicZone {
  axis: "seo" | "product" | "social" | "content" | "paid" | "youtube"
  zone: "red" | "saturated" | "neutral" | "green"
  description: string
  directive: string
}

export interface RadarEntry {
  entity: string
  seo: number
  product: number
  social: number
  content: number
  positioning: number
}

export interface BenchmarkData {
  competitor_scores: CompetitorScore[]
  strategic_zones: StrategicZone[]
  radar_data: RadarEntry[]
}

// ── Module 6 — Recommandations ────────────────────────────────────────────────

export interface Threat {
  description: string
  urgency: "critical" | "medium" | "monitor"
  source: string
}

export interface Opportunity {
  description: string
  effort: "low" | "medium" | "high"
  impact: "high" | "medium" | "low"
  timeframe: "< 30 jours" | "30-60 jours"
}

export interface ActionPhase {
  phase: 1 | 2
  label: string
  objective: string
  actions: string[]
}

export interface RecommendationsContext {
  repositioning_angle: string
  priority_channels: string[]
  content_type_to_exploit: string
  threats: Threat[]
  opportunities: Opportunity[]
  action_plan_template: ActionPhase[]
}

// ── Output final CIA-03 ───────────────────────────────────────────────────────

export interface CiaOutput {
  analysis_context: CiaSessionContext
  competitor_scores: CompetitorScore[]
  strategic_zones: StrategicZone[]
  product_messaging: MessagingAnalysis[]
  seo_data: SeoAcquisitionData
  social_matrix: SocialProfile[]
  content_gap_map: ContentGap[]
  threats: Threat[]
  opportunities: Opportunity[]
  action_plan_60d: ActionPhase[]
  previous_scores?: Record<string, number>
}

// ── Input ─────────────────────────────────────────────────────────────────────

export interface CiaInput {
  brand_profile: ElevayAgentProfile
  session_context: CiaSessionContext
}
