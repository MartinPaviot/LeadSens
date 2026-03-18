import type { SeoData } from "../types";

/** Fetch SEO metrics for a brand domain */
export async function fetchSeo(_brand: string): Promise<SeoData> {
  // TODO: integrate with SEO APIs (e.g. Moz, Ahrefs, Semrush via Composio)
  return {
    domainAuthority: 0,
    organicKeywords: 0,
    backlinks: 0,
  };
}
