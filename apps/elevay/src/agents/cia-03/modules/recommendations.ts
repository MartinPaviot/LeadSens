import type { CiaOutput, RecommendationsData } from "../types";

type RecommendationsInput = Omit<CiaOutput, "recommendations">;

/** Build prioritized recommendations from all module outputs */
export async function buildRecommendations(_data: RecommendationsInput): Promise<RecommendationsData> {
  // TODO: call LLM to synthesize all data into quick wins, strategic initiatives, and KPIs
  return {
    quickWins: [],
    strategicInitiatives: [],
    kpis: [],
  };
}
