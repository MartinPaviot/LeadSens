import type { PressData } from "../types";

/** Fetch press coverage for a brand */
export async function fetchPress(_brand: string): Promise<PressData> {
  // TODO: integrate with a news API (e.g. NewsAPI, Composio)
  return {
    articles: [],
  };
}
