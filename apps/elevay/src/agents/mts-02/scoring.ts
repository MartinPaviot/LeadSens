import type { SynthesisResult } from "./modules/synthesis";

export interface MtsScores {
  opportunity_scores: Record<string, number>
  top_opportunity_score: number  // score du meilleur sujet
  trending_count: number
  saturated_count: number
}

/** Calcule les scores agrégés depuis la synthèse MTS-02 */
export function calculateMtsScores(synthesis: SynthesisResult): MtsScores {
  const scores = Object.values(synthesis.opportunity_scores);
  const top = scores.length > 0 ? Math.max(...scores) : 0;

  return {
    opportunity_scores: synthesis.opportunity_scores,
    top_opportunity_score: top,
    trending_count: synthesis.trending_topics.length,
    saturated_count: synthesis.saturated_topics.length,
  };
}
