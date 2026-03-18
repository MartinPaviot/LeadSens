import type { BpiOutput } from "./types";

export interface BpiScore {
  overall: number;
  breakdown: {
    serpPresence: number;
    pressVisibility: number;
    socialSentiment: number;
    seoStrength: number;
    competitivePosition: number;
  };
}

/** Score brand intelligence data on a 0–100 scale */
export function score(_data: BpiOutput): BpiScore {
  // TODO: implement real scoring logic
  return {
    overall: 0,
    breakdown: {
      serpPresence: 0,
      pressVisibility: 0,
      socialSentiment: 0,
      seoStrength: 0,
      competitivePosition: 0,
    },
  };
}
