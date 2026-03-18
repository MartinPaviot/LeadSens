import type { CompetitiveData } from "../types";

/** Fetch competitive intelligence for a market */
export async function fetchCompetitive(
  _topic: string,
  _industry?: string,
): Promise<CompetitiveData> {
  // TODO: integrate with Semrush, SimilarWeb, or similar via Composio
  return {
    competitors: [],
  };
}
