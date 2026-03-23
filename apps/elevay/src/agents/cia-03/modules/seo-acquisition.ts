import type { ElevayAgentProfile, ModuleResult } from "../../_shared/types";
import type { SeoMetrics, SeoAcquisitionData } from "../types";
import { TTL } from "../../_shared/cache";
import { getKeywordData, searchSerp } from "../../_shared/composio";
import { shouldRunSEO } from "@/lib/channel-filter";

// ── Cache in-memory (V1) ──────────────────────────────────────────────────────

interface CacheEntry { data: SeoMetrics; fetchedAt: number }
const seoCache = new Map<string, CacheEntry>();
const CACHE_KEY = (url: string, country: string) => `cia-seo:${url}:${country}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcSeoScore(rank: number, backlinks: number): number {
  const base = Math.min(100, rank);
  const bonus = Math.min(20, Math.floor(Math.log10(backlinks + 1) * 5));
  return Math.round(base * 0.8 + bonus);
}

async function buildSeoMetrics(
  entityUrl: string,
  country: string,
  primaryKw: string,
  secondaryKw: string,
): Promise<SeoMetrics> {
  const cached = seoCache.get(CACHE_KEY(entityUrl, country));
  if (cached && Date.now() - cached.fetchedAt < TTL.SEO * 1000) {
    return { ...cached.data, cached_at: new Date(cached.fetchedAt).toISOString() };
  }

  const kw = await getKeywordData(entityUrl, country);

  // SERP positions pour primary + secondary keywords
  const serpPositions: Record<string, number | null> = {
    [primaryKw]:   null,
    [secondaryKw]: null,
  };
  let has_google_ads = false;
  let featured_snippets = 0;

  try {
    const [primarySerp, secondarySerp] = await Promise.allSettled([
      searchSerp(primaryKw,   country),
      searchSerp(secondaryKw, country),
    ]);

    if (primarySerp.status === "fulfilled") {
      const results = primarySerp.value.organic_results ?? [];
      const pos = results.findIndex(r => r.link.includes(entityUrl.replace(/^https?:\/\//, "")));
      serpPositions[primaryKw] = pos >= 0 ? pos + 1 : null;
      // has_google_ads : détecter des titres/snippets sponsorisés
      const allText = results.map(r => `${r.title} ${r.snippet}`).join(" ");
      if (/\bsponsored\b|\bpublicit[eé]\b|\bad\b/i.test(allText)) has_google_ads = true;
      // featured_snippets : résultats avec displayed_link (snippet enrichi)
      featured_snippets += results.filter(r => r.displayed_link).length;
    }

    if (secondarySerp.status === "fulfilled") {
      const results = secondarySerp.value.organic_results ?? [];
      const pos = results.findIndex(r => r.link.includes(entityUrl.replace(/^https?:\/\//, "")));
      serpPositions[secondaryKw] = pos >= 0 ? pos + 1 : null;
      featured_snippets += results.filter(r => r.displayed_link).length;
    }
  } catch {
    // SERP non bloquant
  }

  const metrics: SeoMetrics = {
    entity_url:          entityUrl,
    domain_authority:    kw.rank,
    estimated_keywords:  kw.referring_domains,        // proxy V1
    estimated_traffic:   Math.round(kw.backlinks / 10), // proxy V1
    backlink_count:      kw.backlinks,
    serp_positions:      serpPositions,
    has_google_ads,
    featured_snippets:   Math.min(featured_snippets, 20),
    seo_score:           calcSeoScore(kw.rank, kw.backlinks),
  };

  seoCache.set(CACHE_KEY(entityUrl, country), { data: metrics, fetchedAt: Date.now() });
  return metrics;
}

// ── Module principal ──────────────────────────────────────────────────────────

export async function fetchSeoAcquisition(
  profile: ElevayAgentProfile,
  priority_channels?: string[],
): Promise<ModuleResult<SeoAcquisitionData>> {
  if (!shouldRunSEO(priority_channels)) {
    return {
      success: true,
      data: {
        brand_seo: {
          entity_url:         profile.brand_url,
          domain_authority:   0,
          estimated_keywords: 0,
          estimated_traffic:  0,
          backlink_count:     0,
          serp_positions:     {},
          has_google_ads:     false,
          featured_snippets:  0,
          seo_score:          0,
        },
        competitors_seo: [],
      },
      source: "seo-acquisition:skipped",
      degraded: false,
    };
  }

  try {
    // Brand + tous les concurrents en parallèle
    const [brandSettled, ...competitorSettled] = await Promise.allSettled([
      buildSeoMetrics(profile.brand_url,           profile.country, profile.primary_keyword, profile.secondary_keyword),
      ...profile.competitors.map(c =>
        buildSeoMetrics(c.url, profile.country, profile.primary_keyword, profile.secondary_keyword)
      ),
    ]);

    if (brandSettled.status === "rejected") {
      throw brandSettled.reason as Error;
    }

    const brand_seo = brandSettled.value;

    const competitors_seo: SeoMetrics[] = profile.competitors.map((c, i) => {
      const settled = competitorSettled[i];
      if (settled?.status === "fulfilled") return settled.value;
      // Mode dégradé par concurrent
      return {
        entity_url:         c.url,
        domain_authority:   0,
        estimated_keywords: 0,
        estimated_traffic:  0,
        backlink_count:     0,
        serp_positions:     {
          [profile.primary_keyword]:   null,
          [profile.secondary_keyword]: null,
        },
        has_google_ads:    false,
        featured_snippets: 0,
        seo_score:         0,
      };
    });

    // Score relatif : normaliser les seo_scores sur le groupe complet
    const allEntities = [brand_seo, ...competitors_seo];
    const maxScore = Math.max(...allEntities.map(e => e.seo_score), 1);
    for (const entity of allEntities) {
      entity.seo_score = Math.round((entity.seo_score / maxScore) * 100);
    }

    const degraded = competitorSettled.some(s => s.status === "rejected");

    return {
      success: true,
      data: { brand_seo, competitors_seo },
      source: "seo-acquisition:dataforseo",
      degraded,
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      source: "seo-acquisition:dataforseo",
      error: {
        code:    "SEO_ACQUISITION_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
      degraded: true,
    };
  }
}
