import type { MtsOutput } from "./types";

export interface MtsScore {
  overall: number;
  breakdown: {
    trendMomentum: number;
    contentOpportunity: number;
    competitiveGap: number;
    socialRelevance: number;
  };
}

/** Score market trend data on a 0–100 scale */
export function score(_data: MtsOutput): MtsScore {
  // TODO: implement real scoring logic
  return {
    overall: 0,
    breakdown: {
      trendMomentum: 0,
      contentOpportunity: 0,
      competitiveGap: 0,
      socialRelevance: 0,
    },
  };
}
