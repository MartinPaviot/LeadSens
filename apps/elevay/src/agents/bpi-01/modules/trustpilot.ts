import type { ElevayAgentProfile, ModuleResult } from "../../_shared/types";
import type { TrustpilotData } from "../types";
import { searchSerp } from "../../_shared/composio";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sentimentLabel(rating: number): TrustpilotData["sentiment_label"] {
  if (rating >= 4.5) return "Excellent";
  if (rating >= 4.0) return "Great";
  if (rating >= 3.5) return "Average";
  if (rating >= 3.0) return "Poor";
  return "Bad";
}

export function calculateTrustpilotScore(data: TrustpilotData): number {
  if (!data.found || data.rating === undefined) return 50;
  const r = data.rating;
  let base: number;
  if (r >= 4.5)      base = 90 + Math.round((r - 4.5) * 20);
  else if (r >= 4.0) base = 75 + Math.round((r - 4.0) * 28);
  else if (r >= 3.5) base = 60 + Math.round((r - 3.5) * 30);
  else if (r >= 3.0) base = 45 + Math.round((r - 3.0) * 30);
  else               base = Math.round((r / 3.0) * 45);
  const countBonus =
    (data.review_count ?? 0) > 500 ? 10
    : (data.review_count ?? 0) < 50 ? -10
    : 0;
  return Math.min(100, Math.max(0, base + countBonus));
}

function parseTrustpilotSnippet(snippet: string, link: string): TrustpilotData {
  // Matches: "4.2 out of 5", "4.2 / 5", "4.2 stars", "4,2 étoiles", "4.2 sur 5"
  const ratingMatch = snippet.match(
    /(\d+[.,]\d+|\d)\s*(?:\/\s*5|of\s*5|out\s*of\s*5|stars?|étoiles?\b|sur\s*5)/i,
  );
  // Matches: "1,234 reviews", "1 234 avis", "ratings", "évaluations"
  const reviewMatch = snippet.match(
    /([\d,\s]+)\s*(?:reviews?|avis|ratings?|évaluations?)/i,
  );
  const rating = ratingMatch
    ? parseFloat(ratingMatch[1].replace(",", "."))
    : undefined;
  const review_count = reviewMatch
    ? parseInt(reviewMatch[1].replace(/[,\s]/g, ""), 10)
    : undefined;
  return {
    found: true,
    rating,
    review_count: !isNaN(review_count ?? NaN) ? review_count : undefined,
    profile_url: link,
    sentiment_label: rating !== undefined ? sentimentLabel(rating) : undefined,
    degraded: rating === undefined,
  };
}

// ─── Module ───────────────────────────────────────────────────────────────────

/**
 * Module 8 — Trustpilot reputation
 * Source : SerpAPI (site:trustpilot.com query) — no Apify task required
 * Graceful: returns found=false if brand not on Trustpilot
 */
export async function fetchTrustpilot(
  profile: ElevayAgentProfile,
): Promise<ModuleResult<TrustpilotData>> {
  try {
    const { brand_name } = profile;
    const noSpace = brand_name.replace(/\s+/g, "");
    const queries = [
      `site:trustpilot.com/review "${brand_name}"`,
      `site:trustpilot.com/review ${brand_name}`,
      `site:trustpilot.com/review ${noSpace}`,
      `trustpilot ${brand_name} avis`,
    ];

    console.log("[trustpilot] searching for:", brand_name);

    let tpResult: { link: string; snippet: string } | undefined;
    for (const q of queries) {
      const serpRes = await searchSerp(q, profile.country);
      tpResult = serpRes.organic_results.find(
        (r) => r.link.includes("trustpilot.com") && r.snippet,
      );
      if (tpResult) break;
    }

    console.log("[trustpilot] result:", tpResult?.link ?? "not found");

    if (!tpResult) {
      return {
        success: true,
        data: { found: false, degraded: false },
        source: "trustpilot:serp",
      };
    }

    const data = parseTrustpilotSnippet(tpResult.snippet, tpResult.link);
    return {
      success: true,
      data,
      source: "trustpilot:serp",
      degraded: data.degraded,
    };
  } catch (err) {
    return {
      success: false,
      data: { found: false, degraded: true },
      source: "trustpilot:serp",
      error: {
        code: "TRUSTPILOT_FETCH_FAILED",
        message: err instanceof Error ? err.message : String(err),
      },
      degraded: true,
    };
  }
}
