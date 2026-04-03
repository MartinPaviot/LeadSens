export type CampaignObjective = 'branding' | 'conversion' | 'engagement' | 'awareness';
export type InfluencerType = 'micro' | 'macro' | 'mix';
export type Platform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'x';
export type ContentStyle = 'educational' | 'lifestyle' | 'humor' | 'review' | 'ugc' | 'other';

export interface CampaignBrief {
  objective: CampaignObjective;
  sector: string;
  geography: string;
  platforms: Platform[];
  contentStyle: ContentStyle;
  budgetMin: number;
  budgetMax: number;
  priority: 'reach' | 'engagement';
  profileType: InfluencerType;
}

export interface ScoreBreakdown {
  total: number;
  reachEngagement: number;
  thematicAffinity: number;
  brandSafety: number;
  contentQuality: number;
  credibility: number;
}

export interface InfluencerProfile {
  id: string;
  name: string;
  handle: string;
  platforms: Platform[];
  type: InfluencerType;
  followers: number;
  engagementRate: number;
  niche: string;
  estimatedBudgetMin: number;
  estimatedBudgetMax: number;
  score: ScoreBreakdown;
  generatedBrief?: string;
}

export interface ChatMessage {
  id: string;
  role: 'agent' | 'user';
  content: string;
  timestamp: Date;
  type: 'text' | 'brief-summary' | 'results-ready';
  briefData?: Partial<CampaignBrief>;
}

export type AgentPhase = 'brief' | 'searching' | 'results';

export interface AgentState {
  phase: AgentPhase;
  brief: Partial<CampaignBrief>;
  briefComplete: boolean;
  messages: ChatMessage[];
  influencers: InfluencerProfile[];
  selectedInfluencer: InfluencerProfile | null;
  isLoading: boolean;
  filter: 'all' | 'micro' | 'macro';
}

// ─── Onboarding types ────────────────────────────────────

export type InfluencerToolId = 'upfluence' | 'klear' | 'kolsquare' | 'hypeauditor' | 'modash' | 'builtin';

export interface ConnectedTool {
  id: InfluencerToolId;
  apiKey: string;
  connectedAt: string;
}

export interface OnboardingConfig {
  connectedTools: ConnectedTool[];
  priority: InfluencerToolId[];
  builtinEnabled: boolean;
}

export interface InfluencerToolDef {
  id: InfluencerToolId;
  name: string;
  description: string;
  tier: 'primary' | 'fallback';
  color: string;
  abbr: string;
}

export const INFLUENCER_TOOLS: InfluencerToolDef[] = [
  { id: 'upfluence', name: 'Upfluence', description: 'Full influencer database + CRM', tier: 'primary', color: '#6366f1', abbr: 'UF' },
  { id: 'klear', name: 'Klear', description: 'Analytics & audience insights', tier: 'primary', color: '#0ea5e9', abbr: 'KL' },
  { id: 'kolsquare', name: 'Kolsquare', description: 'European influencer platform', tier: 'primary', color: '#f59e0b', abbr: 'KS' },
  { id: 'hypeauditor', name: 'HypeAuditor', description: 'Fraud detection + analytics', tier: 'primary', color: '#ec4899', abbr: 'HA' },
  { id: 'modash', name: 'Modash', description: 'Discovery + filtering', tier: 'primary', color: '#8b5cf6', abbr: 'MD' },
  { id: 'builtin', name: 'Built-in search', description: 'No setup needed — always available', tier: 'fallback', color: '#17C3B2', abbr: 'EL' },
];

// ─── Brief fields ────────────────────────────────────────

export const BRIEF_FIELDS: (keyof CampaignBrief)[] = [
  'objective', 'sector', 'geography', 'platforms',
  'contentStyle', 'budgetMin', 'budgetMax', 'priority', 'profileType',
];
