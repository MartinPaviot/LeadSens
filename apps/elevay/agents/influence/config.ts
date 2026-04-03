import type { CampaignObjective, InfluencerType } from './types';

export const SCORING_WEIGHTS = {
  reachEngagement: 0.40,
  thematicAffinity: 0.25,
  brandSafety: 0.20,
  contentQuality: 0.10,
  credibility: 0.05,
} as const;

export const SCORE_THRESHOLDS = {
  priority: 85,
  recommended: 70,
  atRisk: 0,
} as const;

export const MAX_PROFILES_PER_CAMPAIGN = 100;

export function getScoreColor(score: number): string {
  if (score >= SCORE_THRESHOLDS.priority) return '#17C3B2';
  if (score >= SCORE_THRESHOLDS.recommended) return '#EF9F27';
  return '#E24B4A';
}

export function getScoreLabel(score: number): string {
  if (score >= SCORE_THRESHOLDS.priority) return 'Priority';
  if (score >= SCORE_THRESHOLDS.recommended) return 'Recommended';
  return 'At risk';
}

export function recommendProfileType(budgetMax: number, objective: CampaignObjective): InfluencerType {
  if (budgetMax < 3000) return 'micro';
  if (budgetMax > 10000 && objective === 'awareness') return 'mix';
  if (objective === 'conversion' || objective === 'engagement') return 'micro';
  return 'macro';
}

export const PLATFORM_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  instagram: { bg: '#E1306C', text: '#fff', label: 'IG' },
  tiktok: { bg: '#010101', text: '#fff', label: 'TT' },
  youtube: { bg: '#FF0000', text: '#fff', label: 'YT' },
  linkedin: { bg: '#0A66C2', text: '#fff', label: 'LI' },
  x: { bg: '#1DA1F2', text: '#fff', label: 'X' },
};
