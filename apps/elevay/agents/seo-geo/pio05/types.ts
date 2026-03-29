export type GeoChannel =
  | 'google_search'
  | 'google_ai_overview'
  | 'bing_copilot'
  | 'perplexity'
  | 'google_maps';

export type LlmCitabilityAxis =
  | 'eeat'
  | 'content_structure'
  | 'verifiable_facts'
  | 'authoritative_backlinks';

export interface Pio05Inputs {
  siteUrl: string;
  targetKeywords: string[];
  geoTargets: string[];
  competitorUrls: string[];
  reportFrequency: 'monthly' | 'weekly' | 'on-demand';
  gscConnected: boolean;
  gaConnected: boolean;
}

export interface ChannelVisibility {
  channel: GeoChannel;
  score: number;
  trend: 'up' | 'stable' | 'down';
  topPages: string[];
  notes: string;
}

export interface DualDashboard {
  seoScore: number;
  geoScore: number;
  overallScore: number;
  channels: ChannelVisibility[];
  measuredAt: Date;
}

export interface LlmAxisScore {
  axis: LlmCitabilityAxis;
  weight: number;
  score: number;
  signals: string[];
  recommendations: string[];
}

export interface LlmCitabilityScore {
  total: number;
  axes: LlmAxisScore[];
  topOpportunities: string[];
  measuredAt: Date;
}

export interface LlmStructureIssue {
  url: string;
  issue: string;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
  targetAgent: 'WPW-09' | 'BSW-10' | 'OPT-06';
}

export interface LlmStructureAudit {
  issues: LlmStructureIssue[];
  pagesAudited: number;
  llmReadyPages: number;
  llmReadyRatio: number;
}

export interface CompetitorIntelligence {
  url: string;
  seoScore: number;
  llmCitabilityScore: number;
  topKeywords: string[];
  strengths: string[];
}

export interface Pio05Output {
  dualDashboard: DualDashboard;
  llmCitabilityScore: LlmCitabilityScore;
  llmStructureAudit: LlmStructureAudit;
  competitorIntelligence: CompetitorIntelligence[];
  recommendationsForOpt06: string[];
  recommendationsForContent: string[];
}

export const LLM_AXIS_WEIGHTS: Record<LlmCitabilityAxis, number> = {
  eeat:                    0.25,
  content_structure:       0.25,
  verifiable_facts:        0.25,
  authoritative_backlinks: 0.25,
};

export const LLM_READY_FORMATS = [
  'FAQ schema (FAQPage)',
  'Définition directe en 2 premières phrases',
  'Listes numérotées avec contexte',
  'Tableaux comparatifs balisés',
  "Citations d'experts avec attribution",
  'HowTo schema',
  'Article schema avec datePublished',
] as const;
