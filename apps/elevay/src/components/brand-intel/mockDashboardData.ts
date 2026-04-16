import type { AgentOutput, AgentProfile } from '@/agents/_shared/types'
import type { BpiOutput } from '@/agents/bpi-01/types'
import type { MtsOutput } from '@/agents/mts-02/types'
import type { CiaOutput } from '@/agents/cia-03/types'

const mockProfile: AgentProfile = {
  workspaceId: 'hackathon',
  brand_name: 'GrowthPilot',
  brand_url: 'https://growthpilot.io',
  country: 'US',
  language: 'en',
  competitors: [
    { name: 'MarketForge', url: 'https://marketforge.com' },
    { name: 'ScaleUp AI', url: 'https://scaleup-ai.fr' },
    { name: 'LeadFactory', url: 'https://leadfactory.io' },
  ],
  primary_keyword: 'marketing automation',
  secondary_keyword: 'lead generation SaaS',
  sector: 'Marketing SaaS',
}

export interface DashboardData {
  bpi: AgentOutput<BpiOutput> | null
  mts: AgentOutput<MtsOutput> | null
  cia: AgentOutput<CiaOutput> | null
  profile: typeof mockProfile | null
  fetchedAt: string
}

export const mockDashboardData: DashboardData = {
  bpi: {
    agent_code: 'BPI-01',
    analysis_date: '2026-04-04T10:00:00Z',
    brand_profile: mockProfile,
    payload: {
      scores: {
        global: 62,
        serp: 45,
        press: 30,
        youtube: 55,
        social: 70,
        seo: 78,
        benchmark: 58,
        completeness: 100,
      },
      serp_data: null,
      press_data: null,
      youtube_data: null,
      social_data: null,
      seo_data: null,
      benchmark_data: null,
      googleMapsReputation: null,
      trustpilot: null,
      axis_diagnostics: [
        { axis: 'serp', diagnostic: 'Ranking #4 for brand query — a competitor occupies positions 1-2.' },
        { axis: 'press', diagnostic: 'Very little press coverage. No in-depth articles found.' },
        { axis: 'youtube', diagnostic: 'A few videos mention the brand, but no active official channel.' },
        { axis: 'social', diagnostic: 'Good LinkedIn presence with decent engagement. Instagram underutilized.' },
        { axis: 'seo', diagnostic: 'Decent DA (42). Strong position on primary keyword. Long-tail gaps remain.' },
        { axis: 'benchmark', diagnostic: 'Above average vs direct competitors, but far behind leader MarketForge.' },
      ],
      priorities_90d: [
        { action: 'Reclaim #1 SERP position on brand query via title + schema optimization', tag: 'Urgent', source_problem: 'A competitor is squatting position #1' },
        { action: 'Launch a targeted PR campaign on 5 tech media outlets', tag: 'Mid-term', source_problem: 'Near-zero press coverage' },
        { action: 'Create 3 short YouTube videos on main use cases', tag: 'Quick win', source_problem: 'No official YouTube channel' },
      ],
    },
    degraded_sources: [],
    version: '1.0',
  },
  mts: {
    agent_code: 'MTS-02',
    analysis_date: '2026-04-04T10:30:00Z',
    brand_profile: mockProfile,
    payload: {
      global_score: 71,
      sector: 'Marketing SaaS',
      analysis_period: '30 days',
      mode: 'one-off',
      session_context: {
        sector: 'Marketing SaaS',
        priority_channels: ['SEO', 'LinkedIn'],
      },
      trending_topics: [
        {
          topic: 'Generative AI for marketing personalization',
          opportunity_score: 88,
          growth_4w: 45,
          best_channel: 'LinkedIn',
          classification: 'strong_trend',
          source_confirmation: ['google_trends', 'linkedin', 'youtube'],
          estimated_horizon: '1-3 months',
          suggested_angle: 'How to integrate generative AI into your marketing stack without breaking what works',
        },
        {
          topic: 'End of third-party cookies — first-party data strategies',
          opportunity_score: 75,
          growth_4w: 30,
          best_channel: 'SEO',
          classification: 'strong_trend',
          source_confirmation: ['google_trends', 'press'],
          estimated_horizon: '< 2 weeks',
          suggested_angle: 'Practical guide: collecting and activating first-party data in B2B SaaS',
        },
        {
          topic: 'Revenue Operations (RevOps) unification',
          opportunity_score: 65,
          growth_4w: 20,
          best_channel: 'LinkedIn',
          classification: 'buzz',
          source_confirmation: ['linkedin', 'youtube'],
          estimated_horizon: '1-3 months',
          suggested_angle: 'RevOps: why marketing, sales, and CS teams must merge their data',
        },
        {
          topic: 'Multi-touch attribution and incremental measurement',
          opportunity_score: 52,
          growth_4w: 12,
          best_channel: 'SEO',
          classification: 'weak_signal',
          source_confirmation: ['google_trends'],
          estimated_horizon: '3-6 months',
          suggested_angle: 'Beyond last-click: attribution models for modern B2B',
        },
      ],
      saturated_topics: [
        { topic: 'Marketing automation vs CRM', reason: 'Heavily covered — 500+ articles in top 10 SERP, DA > 60 required' },
        { topic: 'Email marketing best practices', reason: 'Dominated by big players (HubSpot, Mailchimp) — need a unique angle' },
      ],
      content_gap_map: [
        { keyword: 'AI marketing automation', search_volume: 2400, competition: 'medium', opportunity: 'Create a comprehensive guide on AI-assisted marketing automation' },
        { keyword: 'predictive lead scoring', search_volume: 1200, competition: 'low', opportunity: 'SEO article + interactive scoring tool' },
        { keyword: 'RevOps SaaS', search_volume: 800, competition: 'low', opportunity: 'LinkedIn series + SEO pillar article' },
      ],
      format_matrix: [
        { channel: 'SEO', dominant_formats: ['long-form article', 'guide'], avg_engagement: 'medium' },
        { channel: 'LinkedIn', dominant_formats: ['carousel', 'text post', 'short video'], avg_engagement: 'high' },
        { channel: 'YouTube', dominant_formats: ['tutorial', 'interview'], avg_engagement: 'medium' },
      ],
      social_signals: [
        { platform: 'LinkedIn', signal: 'AI marketing posts: engagement 3x above average', engagement_indicator: 'high' },
        { platform: 'YouTube', signal: '"How-to" videos outperform product presentations', engagement_indicator: 'medium' },
      ],
      differentiating_angles: [
        'AI applied to B2B marketing (not B2C) — technical angle + ROI focus',
        'First-party data for scale-stage SaaS (not early-stage startups)',
        '"Human-in-the-loop" automation — counter the fatigue of full-auto AI',
      ],
      roadmap_30d: [
        { week: 1, canal: 'SEO', format: 'Long-form SEO article', suggested_title: 'AI Marketing Automation: The Complete 2026 Guide', topic: 'AI marketing', priority: 'high', objective: 'SEO' },
        { week: 1, canal: 'LinkedIn', format: 'Carousel', suggested_title: '5 AI Marketing Workflows You Can Copy Today', topic: 'AI marketing', priority: 'high', objective: 'lead_gen' },
        { week: 2, canal: 'SEO', format: 'SEO Article', suggested_title: 'First-Party Data in B2B SaaS: Where to Start', topic: 'First-party data', priority: 'high', objective: 'SEO' },
        { week: 2, canal: 'LinkedIn', format: 'Text post', suggested_title: 'We replaced our third-party cookies with... (thread)', topic: 'First-party data', priority: 'medium', objective: 'branding' },
        { week: 3, canal: 'LinkedIn', format: 'Carousel', suggested_title: 'RevOps in SaaS: The 4-Step Framework', topic: 'RevOps', priority: 'medium', objective: 'lead_gen' },
        { week: 3, canal: 'YouTube', format: 'Tutorial', suggested_title: 'RevOps Setup with GrowthPilot in 15 min', topic: 'RevOps', priority: 'medium', objective: 'activation' },
        { week: 4, canal: 'SEO', format: 'SEO Article', suggested_title: 'Predictive Lead Scoring: Methodology + Free Tool', topic: 'Predictive lead scoring', priority: 'medium', objective: 'SEO' },
        { week: 4, canal: 'LinkedIn', format: 'Short video', suggested_title: 'Demo: AI Scoring in Action on Real Leads', topic: 'Predictive lead scoring', priority: 'low', objective: 'activation' },
      ],
      opportunity_scores: {
        'AI marketing': 88,
        'First-party data': 75,
        'RevOps': 65,
        'Multi-touch attribution': 52,
      },
    },
    degraded_sources: [],
    version: '1.0',
  },
  cia: {
    agent_code: 'CIA-03',
    analysis_date: '2026-04-04T11:00:00Z',
    brand_profile: mockProfile,
    payload: {
      brand_score: 58,
      analysis_date: '2026-04-04T11:00:00Z',
      analysis_context: {
        priority_channels: ['SEO', 'LinkedIn'],
        objective: 'lead_gen',
      },
      competitor_scores: [
        { entity: 'MarketForge', is_client: false, seo_score: 82, product_score: 78, social_score: 75, content_score: 80, positioning_score: 70, global_score: 78, level: 'strong' },
        { entity: 'GrowthPilot', is_client: true, seo_score: 68, product_score: 60, social_score: 55, content_score: 50, positioning_score: 55, global_score: 58, level: 'competitive' },
        { entity: 'ScaleUp AI', is_client: false, seo_score: 55, product_score: 70, social_score: 60, content_score: 45, positioning_score: 65, global_score: 58, level: 'competitive' },
        { entity: 'LeadFactory', is_client: false, seo_score: 40, product_score: 45, social_score: 35, content_score: 30, positioning_score: 40, global_score: 38, level: 'weak' },
      ],
      strategic_zones: [
        { axis: 'seo', zone: 'neutral', description: 'Decent SEO position but not dominant', directive: 'Maintain and monitor competitor movements' },
        { axis: 'product', zone: 'red', description: 'MarketForge dominates on product messaging', directive: 'Rework value proposition and CTAs' },
        { axis: 'social', zone: 'saturated', description: 'All competitors investing heavily in LinkedIn', directive: 'Differentiate format rather than volume' },
        { axis: 'content', zone: 'green', description: 'Low content production among direct competitors', directive: 'Capitalize with an aggressive editorial calendar' },
        { axis: 'paid', zone: 'neutral', description: 'No advertising data available', directive: 'Explore paid opportunities if budget allows' },
        { axis: 'youtube', zone: 'green', description: 'No competitor active on YouTube', directive: 'Launch a YouTube channel before competitors invest' },
      ],
      product_messaging: [],
      seo_data: {
        brand_seo: { domain: 'growthpilot.io', domain_authority: 42, organic_traffic_estimate: 3200, top_keywords: [{ keyword: 'marketing automation', position: 4, volume: 8100 }] },
        competitors_seo: [
          { domain: 'marketforge.com', domain_authority: 62, organic_traffic_estimate: 12000, keyword_overlap: 45 },
          { domain: 'scaleup-ai.fr', domain_authority: 35, organic_traffic_estimate: 1500, keyword_overlap: 30 },
          { domain: 'leadfactory.io', domain_authority: 28, organic_traffic_estimate: 800, keyword_overlap: 20 },
        ],
      },
      social_matrix: [],
      content_gap_map: [
        { keyword: 'AI marketing automation', brand_covered: false, opportunity: 'Create a comprehensive guide' },
        { keyword: 'predictive lead scoring', brand_covered: false, opportunity: 'Article + interactive tool' },
      ],
      content_competitors: [],
      threats: [
        { description: 'MarketForge dominates product messaging — risk of losing market share', urgency: 'high', source: 'product' },
        { description: 'High SEO keyword overlap with MarketForge (45%) — traffic cannibalization risk', urgency: 'medium', source: 'seo' },
        { description: 'Social axis saturated — all competitors investing in LinkedIn', urgency: 'medium', source: 'social' },
      ],
      opportunities: [
        { description: 'Green content zone — aggressive editorial calendar to gain the edge', effort: 'medium', impact: 'high', timeframe: '< 30 days' },
        { description: 'YouTube is untouched — launch a channel before competitors invest', effort: 'low', impact: 'high', timeframe: '< 30 days' },
        { description: 'LeadFactory is vulnerable — capture their audience with targeted content', effort: 'medium', impact: 'medium', timeframe: '30-60 days' },
      ],
      action_plan_60d: [
        {
          phase: 1,
          label: 'Phase 1: Defense',
          objective: 'Address urgent threats and seize quick wins',
          actions: [
            '[DEFENSE] Rework hero message and value prop — align on AI + ROI positioning',
            '[QUICK WIN] Launch 3 short YouTube videos — use cases, product demo, tutorial',
            '[ACTION] Publish 4 SEO articles on identified content gaps',
          ],
        },
        {
          phase: 2,
          label: 'Phase 2: Attack',
          objective: 'Exploit opportunities and strengthen positions',
          actions: [
            '[ATTACK] Editorial calendar: 2 articles/week for 8 weeks',
            '[ATTACK] Differentiated LinkedIn campaign — video + carousel vs text posts',
            '[MONITOR] Track MarketForge DA evolution and keyword overlap',
          ],
        },
      ],
    },
    degraded_sources: [],
    version: '1.0',
  },
  profile: mockProfile,
  fetchedAt: '2026-04-04T11:30:00Z',
}
