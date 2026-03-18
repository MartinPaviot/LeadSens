import type { SerpData } from "../types";

/** Fetch SERP results for a brand query */
export async function fetchSerp(_brand: string): Promise<SerpData> {
  // TODO: integrate with a SERP API (e.g. Composio, SerpAPI, Brave Search)
  return {
    query: _brand,
    results: [],
  };
}
