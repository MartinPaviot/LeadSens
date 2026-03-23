import type { ElevayAgentProfile, ModuleResult } from "../../_shared/types";
import type { SeoData, CompetitorSeoData } from "../types";
import { TTL } from "../../_shared/cache";
import { getKeywordData } from "../../_shared/composio";
import { shouldRunSEO } from "@/lib/channel-filter";

// ─── Cache ────────────────────────────────────────────────────────────────────

/** Cache in-memory V1 (remplacé par Redis en V2) */
const seoCache = new Map<string, { data: SeoData; fetchedAt: number }>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcSeoScore(rank: number, backlinks: number): number {
  const base = Math.min(100, rank);
  const backlinkBonus = Math.min(
    20,
    Math.floor(Math.log10(backlinks + 1) * 5),
  );
  return Math.round(base * 0.8 + backlinkBonus);
}

// ─── Module ───────────────────────────────────────────────────────────────────

/**
 * Module 3 — SEO & Visibilité organique
 * Source : DataForSEO via Composio (retry ×2, 1s exponentiel)
 * Cache : 30 jours (TTL.SEO), clé `seo:${brand_url}:${country}`
 */
export async function fetchSeo(
  profile: ElevayAgentProfile,
  priority_channels?: string[],
): Promise<ModuleResult<SeoData>> {
  if (!shouldRunSEO(priority_channels)) {
    return {
      success: true,
      data: {
        keyword_positions: {},
        domain_authority: 0,
        backlink_count: 0,
        competitor_comparison: [],
        keyword_gaps: [],
        seo_score: 0,
      },
      source: "seo:skipped",
      degraded: false,
    };
  }

  const cacheKey = `seo:${profile.brand_url}:${profile.country}`;

  try {
    // Check cache before any DataForSEO call
    const cached = seoCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < TTL.SEO * 1000) {
      return {
        success: true,
        data: {
          ...cached.data,
          cached_at: new Date(cached.fetchedAt).toISOString(),
        },
        source: "seo:cache",
      };
    }

    // Fetch brand + all competitors in parallel
    const [brandResult, ...competitorResults] = await Promise.allSettled([
      getKeywordData(profile.brand_url, profile.country),
      ...profile.competitors.map((c) =>
        getKeywordData(c.url, profile.country),
      ),
    ]);

    if (brandResult.status === "rejected") {
      throw brandResult.reason as Error;
    }

    const brand = brandResult.value;

    // Build competitor_comparison
    const competitor_comparison: CompetitorSeoData[] = profile.competitors.map(
      (c, i) => {
        const res = competitorResults[i];
        if (res.status === "fulfilled") {
          const { rank, backlinks } = res.value;
          return {
            competitor: c.name,
            domain_authority: rank,
            keyword_positions: {
              [profile.primary_keyword]: null,
              [profile.secondary_keyword]: null,
            },
            seo_score: calcSeoScore(rank, backlinks),
          };
        }
        return {
          competitor: c.name,
          domain_authority: 0,
          keyword_positions: {
            [profile.primary_keyword]: null,
            [profile.secondary_keyword]: null,
          },
          seo_score: 0,
        };
      },
    );

    // keyword_gaps — based on relative DA and backlinks
    const validCompetitors = competitorResults.filter(
      (r): r is PromiseFulfilledResult<typeof brand> =>
        r.status === "fulfilled",
    );
    const avgCompDA =
      validCompetitors.length > 0
        ? validCompetitors.reduce((sum, r) => sum + r.value.rank, 0) /
          validCompetitors.length
        : 0;
    const avgCompBacklinks =
      validCompetitors.length > 0
        ? validCompetitors.reduce((sum, r) => sum + r.value.backlinks, 0) /
          validCompetitors.length
        : 0;

    const keyword_gaps: string[] = [];
    if (brand.rank < avgCompDA) {
      keyword_gaps.push(`"${profile.primary_keyword} gratuit"`);
    }
    if (brand.backlinks < avgCompBacklinks) {
      keyword_gaps.push(`"meilleur ${profile.secondary_keyword}"`);
    }
    keyword_gaps.push(`"${profile.brand_name} alternative"`);

    const data: SeoData = {
      keyword_positions: {
        [profile.primary_keyword]: null,
        [profile.secondary_keyword]: null,
      },
      domain_authority: brand.rank,
      backlink_count: brand.backlinks,
      competitor_comparison,
      keyword_gaps,
      seo_score: calcSeoScore(brand.rank, brand.backlinks),
    };

    seoCache.set(cacheKey, { data, fetchedAt: Date.now() });

    return { success: true, data, source: "seo:dataforseo" };
  } catch (err) {
    // Degraded mode: return cache if available
    const cached = seoCache.get(cacheKey);
    if (cached) {
      return {
        success: true,
        data: {
          ...cached.data,
          cached_at: new Date(cached.fetchedAt).toISOString(),
        },
        source: "seo:cache",
        degraded: true,
      };
    }

    return {
      success: false,
      data: null,
      source: "seo:dataforseo",
      error: {
        code: "SEO_FETCH_FAILED",
        message: err instanceof Error ? err.message : "Erreur inconnue",
      },
      degraded: true,
    };
  }
}
