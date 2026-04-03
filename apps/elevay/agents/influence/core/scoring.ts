import { SCORING_WEIGHTS } from '../config';
import type { ScoreBreakdown } from '../types';

export function computeTotalScore(components: Omit<ScoreBreakdown, 'total'>): ScoreBreakdown {
  const total = Math.round(
    components.reachEngagement * SCORING_WEIGHTS.reachEngagement +
    components.thematicAffinity * SCORING_WEIGHTS.thematicAffinity +
    components.brandSafety * SCORING_WEIGHTS.brandSafety +
    components.contentQuality * SCORING_WEIGHTS.contentQuality +
    components.credibility * SCORING_WEIGHTS.credibility,
  );
  return { ...components, total };
}

export function sortByScore<T extends { score: ScoreBreakdown }>(profiles: T[]): T[] {
  return [...profiles].sort((a, b) => b.score.total - a.score.total);
}
