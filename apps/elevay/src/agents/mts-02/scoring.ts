import type { SynthesisResult } from "./modules/synthesis";

export interface MtsScores {
  global_score: number               // moyenne des top 5 scores
  opportunity_scores: Record<string, number>
  top_opportunity_score: number      // score du meilleur sujet
  trending_count: number
  saturated_count: number
}

/** Calcule les scores agrégés depuis la synthèse MTS-02 */
export function calculateMtsScores(synthesis: SynthesisResult): MtsScores {
  const scores = Object.values(synthesis.opportunity_scores)
    .sort((a, b) => b - a);
  const top = scores.length > 0 ? scores[0] : 0;

  // Global = moyenne des top 5 topic scores
  const top5 = scores.slice(0, 5);
  const global_score = top5.length > 0
    ? Math.round(top5.reduce((s, v) => s + v, 0) / top5.length)
    : 0;

  return {
    global_score,
    opportunity_scores: synthesis.opportunity_scores,
    top_opportunity_score: top,
    trending_count: synthesis.trending_topics.length,
    saturated_count: synthesis.saturated_topics.length,
  };
}
