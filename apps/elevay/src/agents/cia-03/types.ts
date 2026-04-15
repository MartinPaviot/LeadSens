export interface MessagingAnalysis {
  competitor_url: string
  hero_message: string
  value_prop: string
  primary_cta: string
  pricing_posture: 'premium' | 'mid-market' | 'low-cost' | 'freemium' | 'unknown'
  dominant_angle: string
  messaging_clarity_score: number       // 0-100
  differentiation_score: number         // 0-100 (vs brand)
  scraping_success: boolean
}

export interface SeoAcquisitionData {
  brand_seo: {
    domain: string
    domain_authority: number | null
    organic_traffic_estimate: number | null
    top_keywords: Array<{ keyword: string; position: number; volume: number }>
  }
  competitors_seo: Array<{
    domain: string
    domain_authority: number | null
    organic_traffic_estimate: number | null
    keyword_overlap: number             // % de mots-clés en commun
  }>
}

export interface SocialProfile {
  entity: string                         // brand ou competitor name
  platform: string
  followers: number | null
  posting_frequency: string             // "3x/semaine"
  engagement_rate: number | null
  dominant_formats: string[]
}

export interface ContentAnalysisData {
  brand_content: {
    blog_frequency: string
    avg_word_count: number | null
    content_themes: string[]
    has_youtube: boolean
    has_lead_magnets: boolean
  }
  competitors_content: Array<{
    name: string
    blog_frequency: string
    content_themes: string[]
    has_youtube: boolean
    unique_angles: string[]
  }>
  content_gap_map: Array<{ keyword: string; brand_covered: boolean; opportunity: string }>
}

export interface CompetitorScore {
  entity: string
  is_client: boolean
  seo_score: number
  product_score: number
  social_score: number
  content_score: number
  positioning_score: number
  global_score: number
  level: 'vulnerable' | 'weak' | 'competitive' | 'strong' | 'dominant'
}

export interface StrategicZone {
  axis: 'seo' | 'product' | 'social' | 'content' | 'paid' | 'youtube'
  zone: 'red' | 'saturated' | 'neutral' | 'green'
  description: string
  directive: string
}

export interface Threat {
  description: string
  urgency: 'high' | 'medium' | 'low'
  source: string                         // e.g. "seo", "messaging"
}

export interface Opportunity {
  description: string
  effort: 'low' | 'medium' | 'high'
  impact: 'high' | 'medium' | 'low'
  timeframe: string
}

export interface ActionPhase {
  phase: 1 | 2
  label: string                          // "Phase 1 : Défense" | "Phase 2 : Attaque"
  objective: string
  actions: string[]
}

export interface CiaSessionContext {
  priority_channels: string[]
  objective: 'lead_gen' | 'acquisition' | 'retention' | 'branding'
}

export interface CiaOutput {
  brand_score: number
  analysis_date: string
  analysis_context: CiaSessionContext
  competitor_scores: CompetitorScore[]
  strategic_zones: StrategicZone[]
  product_messaging: MessagingAnalysis[]
  seo_data: SeoAcquisitionData
  social_matrix: SocialProfile[]
  content_gap_map: ContentAnalysisData['content_gap_map']
  content_competitors: ContentAnalysisData['competitors_content']
  threats: Threat[]
  opportunities: Opportunity[]
  action_plan_60d: ActionPhase[]
  previous?: {
    date: string
    brand_score: number
    competitor_scores: Array<{ entity: string; global_score: number }>
  }
  warning?: string
}
