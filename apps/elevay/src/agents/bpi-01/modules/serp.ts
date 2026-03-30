import type { ElevayAgentProfile, ModuleResult } from "../../_shared/types";
import type { SerpData } from "../types";
import { searchSerp } from "../../_shared/composio";
import type { SerpOrganicResult } from "../../_shared/composio";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0].toLowerCase();
}

const NEGATIVE_MARKERS = [
  "scam",
  "arnaque",
  "problème",
  "fraude",
  "avis négatif",
  "escroquerie",
  "danger",
];

function hasNegativeContent(results: SerpOrganicResult[]): boolean {
  return results.some((r) => {
    const text = `${r.title} ${r.snippet ?? ""}`.toLowerCase();
    return NEGATIVE_MARKERS.some((m) => text.includes(m));
  });
}

function collectNegativeSnippets(results: SerpOrganicResult[]): string[] {
  return results
    .filter((r) => {
      const text = `${r.title} ${r.snippet ?? ""}`.toLowerCase();
      return NEGATIVE_MARKERS.some((m) => text.includes(m));
    })
    .map((r) => `${r.title}: ${r.snippet ?? ""}`);
}

function findDomainPosition(
  results: SerpOrganicResult[],
  domain: string,
): number | null {
  const match = results.find((r) => extractDomain(r.link) === domain);
  return match ? match.position : null;
}

function calcVisibility(position: number | null): number {
  return position !== null ? Math.max(0, 108 - position * 8) : 0;
}

// ─── Module ───────────────────────────────────────────────────────────────────

/**
 * Module 1 — Audit SERP intelligent
 * Source : SerpAPI via Composio
 * Limite : 5 requêtes par audit (budget 7)
 * Retry : ×2, délai 1s exponentiel (géré dans composio.searchSerp)
 */
export async function fetchSerp(
  profile: ElevayAgentProfile,
): Promise<ModuleResult<SerpData>> {
  try {
    const { brand_name, brand_url, primary_keyword, country, competitors } =
      profile;
    const brandDomain = extractDomain(brand_url);

    const queries = [
      brand_name,                         // q1 → official_site_position
      `${brand_name} avis`,               // q2 → sentiment avis
      `${brand_name} problème`,           // q3 → contenus négatifs
      `${brand_name} scam`,               // q4 → signaux réputationnels
      primary_keyword,                    // q5 → positions organiques
    ];

    const settled = await Promise.allSettled(
      queries.map((q) => searchSerp(q, country)),
    );

    if (settled.every((r) => r.status === "rejected")) {
      return {
        success: false,
        data: null,
        source: "serp:serpapi",
        error: { code: "SERP_FETCH_FAILED", message: "All SERP queries failed" },
        degraded: true,
      };
    }

    const organic = settled.map((r) =>
      r.status === "fulfilled" ? r.value.organic_results : [],
    );
    const [q1, q2, q3, q4, q5] = organic;

    // official_site_position — q1 first, q5 fallback
    const official_site_position =
      findDomainPosition(q1, brandDomain) ?? findDomainPosition(q5, brandDomain);

    // negative_snippets — across all queries
    const allResults = ([] as SerpOrganicResult[]).concat(...organic);
    const negative_snippets = collectNegativeSnippets(allResults);

    // competitor_positions — reuse q1 + q5 results, 0 extra calls
    const competitor_positions: Record<string, number | null> = {};
    for (const c of competitors) {
      const compDomain = extractDomain(c.url);
      competitor_positions[c.name] =
        findDomainPosition(q1, compDomain) ??
        findDomainPosition(q5, compDomain);
    }

    // visibility_score (1→100, 2→92, ..., 10→28, null→0)
    const visibility_score = calcVisibility(official_site_position);

    // reputation_score
    let reputation_score = 100;
    if (hasNegativeContent(q4)) reputation_score -= 25;
    if (hasNegativeContent(q3)) reputation_score -= 15;
    if (hasNegativeContent(q2)) reputation_score -= 10;
    reputation_score = Math.max(0, reputation_score);

    return {
      success: true,
      data: {
        official_site_position,
        negative_snippets,
        competitor_positions,
        visibility_score,
        reputation_score,
      },
      source: "serp:serpapi",
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      source: "serp:serpapi",
      error: {
        code: "SERP_FETCH_FAILED",
        message: err instanceof Error ? err.message : "Erreur inconnue",
      },
      degraded: true,
    };
  }
}
