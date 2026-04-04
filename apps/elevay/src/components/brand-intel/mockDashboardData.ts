import type { BpiOutput } from '@/agents/bpi-01/types';
import type { MtsOutput } from '@/agents/mts-02/types';
import type { CiaOutput } from '@/agents/cia-03/types';

export const MOCK_BPI: BpiOutput = {
  scores: {
    global: 68, serp: 72, press: 55, youtube: 40, social: 78, seo: 58, benchmark: 63, completeness: 85,
    previous: { global: 64, serp: 70, press: 55, youtube: 43, social: 70, seo: 57, benchmark: 59, date: '2026-03-01' },
  },
  serp_data: null, seo_data: null, press_data: null, youtube_data: null, social_data: null, benchmark_data: null,
  axis_diagnostics: [
    { axis: 'serp', diagnostic: 'Bonne maîtrise de la page 1 sur la requête de marque' },
    { axis: 'press', diagnostic: 'Couverture limitée — 3× moins que le concurrent principal' },
    { axis: 'youtube', diagnostic: 'Aucune vidéo trouvée sur les 3 requêtes stratégiques' },
    { axis: 'social', diagnostic: 'Engagement solide sur LinkedIn et Instagram' },
    { axis: 'seo', diagnostic: 'DA 42 — manque de backlinks sur /pricing et /features' },
    { axis: 'benchmark', diagnostic: 'Position 3/4 dans le classement concurrentiel' },
  ],
  priorities_90d: [
    { action: 'Créer une présence YouTube — 0 vidéo sur 3 requêtes clés', tag: 'Urgent', source_problem: 'Score YouTube 40/100' },
    { action: 'Presse sectorielle : 3× moins de couverture que le concurrent principal', tag: 'Moyen terme', source_problem: 'Score Presse 55/100' },
    { action: 'Optimiser /pricing — DA 42, aucun backlink entrant détecté', tag: 'Quick win', source_problem: 'Score SEO 58/100' },
  ],
};

export const MOCK_MTS: MtsOutput = {
  global_score: 81,
  sector: 'B2B SaaS Marketing',
  analysis_period: 'Mars 2026',
  mode: 'ponctuel',
  session_context: { sector: 'B2B SaaS', priority_channels: ['SEO', 'LinkedIn'] },
  trending_topics: [
    { topic: 'AI agent for sales teams', opportunity_score: 88, growth_4w: 68, classification: 'strong_trend', best_channel: 'SEO', estimated_horizon: '3 mois', source_confirmation: ['Google Trends', 'SerpAPI'], suggested_angle: 'Comparatif AI agents vs outils classiques' },
    { topic: 'Marketing automation SMB', opportunity_score: 79, growth_4w: 41, classification: 'strong_trend', best_channel: 'LinkedIn', estimated_horizon: '6 mois', source_confirmation: ['Google Trends'], suggested_angle: 'Guide pratique pour PME' },
    { topic: 'Outbound automatisé B2B', opportunity_score: 74, growth_4w: 32, classification: 'buzz', best_channel: 'YouTube', estimated_horizon: '3 mois', source_confirmation: ['Reddit'], suggested_angle: 'Démo workflow complet' },
    { topic: 'No-code marketing tools', opportunity_score: 71, growth_4w: 28, classification: 'buzz', best_channel: 'SEO', estimated_horizon: '6 mois', source_confirmation: ['ProductHunt'], suggested_angle: 'Top 10 outils no-code 2026' },
    { topic: 'RevOps for scale-ups', opportunity_score: 65, growth_4w: 22, classification: 'weak_signal', best_channel: 'LinkedIn', estimated_horizon: '12 mois', source_confirmation: ['LinkedIn Pulse'], suggested_angle: 'Framework RevOps simplifié' },
  ],
  saturated_topics: [
    { topic: 'ROI marketing automation', reason: 'Angle épuisé — 200+ articles concurrents' },
    { topic: 'Best CRM for startups', reason: 'Saturé par Salesforce et HubSpot' },
    { topic: 'Email marketing best practices', reason: 'Sujet trop large — aucune différenciation possible' },
  ],
  content_gap_map: [],
  format_matrix: [
    { canal: 'SEO', dominant_format: 'Guide long-form', dominant_tone: 'Expert', example: '10 000 mots + checklist' },
    { canal: 'LinkedIn', dominant_format: 'Carousel', dominant_tone: 'Storytelling', example: '8 slides + hook provocateur' },
    { canal: 'YouTube', dominant_format: 'Démo produit', dominant_tone: 'Didactique', example: '8–12 min, screen recording' },
  ],
  social_signals: [],
  differentiating_angles: ['Simplicité SMB vs complexité enterprise', 'AI-first marketing stack', 'ROI prouvé en 30 jours'],
  roadmap_30d: [
    { week: 1, canal: 'SEO', format: 'Article', suggested_title: 'AI agents vs automation traditionnelle', topic: 'AI agents', priority: 'high', objective: 'SEO' },
    { week: 1, canal: 'LinkedIn', format: 'Post ×3', suggested_title: 'Hooks sur AI agents + marketing SMB', topic: 'AI agents', priority: 'high', objective: 'branding' },
    { week: 2, canal: 'Lead gen', format: 'Checklist PDF', suggested_title: 'Votre stack marketing AI-ready ?', topic: 'Marketing automation', priority: 'medium', objective: 'lead_gen' },
    { week: 2, canal: 'YouTube', format: 'Vidéo démo', suggested_title: 'Elevay automatise le marketing en 5 min', topic: 'Produit', priority: 'medium', objective: 'branding' },
    { week: 3, canal: 'LinkedIn', format: 'Thread', suggested_title: 'PME vs Enterprise : la simplicité gagne', topic: 'Positioning', priority: 'medium', objective: 'branding' },
    { week: 4, canal: 'SEO', format: 'Article', suggested_title: 'Marketing automation SMB 2026', topic: 'Marketing automation', priority: 'high', objective: 'SEO' },
  ],
  opportunity_scores: {},
  previous: { global_score: 76, trending_topics: ['AI agent for sales teams'], saturated_topics: ['ROI marketing automation'], date: '2026-03-01' },
};

export const MOCK_CIA: CiaOutput = {
  brand_score: 68,
  analysis_date: '2026-04-03',
  analysis_context: { priority_channels: ['SEO', 'LinkedIn'], objective: 'lead_gen' },
  competitor_scores: [
    { entity: 'Elevay', is_client: true, global_score: 68, level: 'competitive', seo_score: 58, product_score: 72, social_score: 78, content_score: 60, positioning_score: 65 },
    { entity: 'Lindy', is_client: false, global_score: 84, level: 'dominant', seo_score: 88, product_score: 82, social_score: 80, content_score: 86, positioning_score: 84 },
    { entity: 'Dust', is_client: false, global_score: 77, level: 'competitive', seo_score: 75, product_score: 80, social_score: 72, content_score: 81, positioning_score: 70 },
    { entity: 'Limova', is_client: false, global_score: 61, level: 'weak', seo_score: 52, product_score: 65, social_score: 58, content_score: 69, positioning_score: 55 },
  ],
  strategic_zones: [
    { axis: 'seo', zone: 'red', description: 'Dominé par Lindy sur 3 mots-clés stratégiques', directive: 'Investir en link building + contenu pilier' },
    { axis: 'youtube', zone: 'green', description: 'Aucun concurrent actif sur YouTube', directive: 'Lancer 3 vidéos démo en priorité' },
    { axis: 'product', zone: 'green', description: 'Messaging "simplicité SMB" non exploité', directive: 'Repositionner le messaging homepage' },
    { axis: 'content', zone: 'saturated', description: 'Contenu "ROI marketing" — angle épuisé', directive: 'Pivoter vers des angles différenciants' },
  ],
  product_messaging: [],
  seo_data: { brand_seo: { entity_url: 'elevay.app', domain_authority: 42, estimated_keywords: 340, backlink_count: 1200, estimated_traffic: 8500, seo_score: 58, has_google_ads: false, featured_snippets: 0, serp_positions: {} }, competitors_seo: [] },
  social_matrix: [],
  content_gap_map: [],
  content_competitors: [],
  threats: [{ urgency: 'critical', description: 'Lindy lance une fonctionnalité AI agent similaire', source: 'Product Hunt' }],
  opportunities: [
    { description: 'Lancer YouTube — aucun concurrent actif, audience captive', effort: 'medium', impact: 'high', timeframe: '30-60 jours' },
    { description: 'Angle "simplicité SMB" libre — repositionner le messaging', effort: 'low', impact: 'high', timeframe: '< 30 jours' },
  ],
  action_plan_60d: [
    { phase: 1, label: 'J1–J30 : Lancement et quick wins', objective: 'Combler le gap YouTube + attaquer "AI agent marketing SMB"', actions: ['Lancer YouTube — 3 vidéos démo en 30 jours', 'Attaquer le mot-clé "AI agent marketing SMB" — article pilier', 'Optimiser /pricing — 0 backlink détecté'] },
    { phase: 2, label: 'J31–J60 : Consolidation', objective: 'Repositionner le messaging et amplifier le contenu performant', actions: ['Repositionner homepage sur "simplicité SMB"', 'Lancer campagne backlinks sur 10 sites cibles', 'Doubler sur YouTube si les 3 premières vidéos performent'] },
  ],
  previous: { date: '2026-03-01', competitor_scores: [{ entity: 'Elevay', global_score: 64 }, { entity: 'Lindy', global_score: 86 }, { entity: 'Dust', global_score: 76 }, { entity: 'Limova', global_score: 61 }] },
};

export const BPI_MODULES = ['SERP & Google', 'Presse & Mentions', 'YouTube', 'Réseaux sociaux', 'SEO organique', 'Benchmark concurrentiel', 'Avis Google', 'Trustpilot'];
export const MTS_MODULES = ['Tendances marché', 'Signaux sociaux', 'Gap map contenu', 'Formats performants', 'Roadmap 30j'];
export const CIA_MODULES = ['Scores concurrents', 'Messaging produit', 'SEO & Acquisition', 'Social media', 'Contenu', 'Benchmark'];
