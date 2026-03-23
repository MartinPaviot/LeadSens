import type { CompetitorScore } from "./types";
import type { ElevayAgentProfile } from "../_shared/types";
import type { BenchmarkData } from "./types";

export interface CiaScores {
  competitor_scores: CompetitorScore[]
  brand_global_score: number
}

/** Calcule les scores compétitifs depuis le benchmark (spec §4 — pondération 4×25%) */
export function calculateCiaScores(
  benchmarkData: BenchmarkData,
  profile: ElevayAgentProfile,
): CiaScores {
  const brand = benchmarkData.competitor_scores.find(
    s => s.is_client || s.entity === profile.brand_url,
  );

  return {
    competitor_scores: benchmarkData.competitor_scores,
    brand_global_score: brand?.global_score ?? 0,
  };
}
