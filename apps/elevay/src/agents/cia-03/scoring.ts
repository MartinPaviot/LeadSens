import type { CiaOutput } from "./types";

export interface CiaScore {
  overall: number;
  breakdown: {
    messagingClarity: number;
    seoReadiness: number;
    socialPresence: number;
    contentMaturity: number;
    competitivePosition: number;
  };
}

/** Score the full marketing intelligence output on a 0–100 scale */
export function score(_data: CiaOutput): CiaScore {
  // TODO: implement real scoring logic
  return {
    overall: 0,
    breakdown: {
      messagingClarity: 0,
      seoReadiness: 0,
      socialPresence: 0,
      contentMaturity: 0,
      competitivePosition: 0,
    },
  };
}
