import type { ElevayAgentProfile, ModuleResult } from "../../_shared/types";
import { getKeywordData, searchNews } from "../../_shared/composio";
import type { KeywordTrend, TrendsData } from "../types";
import { shouldRunSEO } from "@/lib/channel-filter";

// ── Cache 7j ──────────────────────────────────────────────────────────────────

const TRENDS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  data: TrendsData
  cachedAt: number
}

const trendsCache = new Map<string, CacheEntry>();

// ── Google Trends via SerpAPI ─────────────────────────────────────────────────

interface TimelinePoint {
  date: string
  values: { query: string; value: string }[]
}

interface GoogleTrendsResponse {
  interest_over_time?: {
    timeline_data?: TimelinePoint[]
  }
}

interface TrendsResult {
  averages: Record<string, number>;
  halfGrowth: Record<string, number>; // first-half vs second-half growth %
}

async function fetchGoogleTrends(
  keywords: string[],
  geoCode: string,
  dateRange: "today 1-m" | "today 3-m",
): Promise<TrendsResult> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY is not set");

  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google_trends");
  url.searchParams.set("q", keywords.slice(0, 5).join(","));
  url.searchParams.set("date", dateRange);
  url.searchParams.set("geo", geoCode.toUpperCase().slice(0, 2));
  url.searchParams.set("data_type", "TIMESERIES");
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`SerpAPI Google Trends: HTTP ${res.status}`);

  const json = (await res.json()) as GoogleTrendsResponse;
  const timeline = json.interest_over_time?.timeline_data ?? [];

  // Collect per-keyword values in order
  const series: Record<string, number[]> = {};

  for (const point of timeline) {
    for (const v of point.values ?? []) {
      const kw = v.query;
      const val = parseInt(v.value, 10) || 0;
      if (!series[kw]) series[kw] = [];
      series[kw].push(val);
    }
  }

  const averages: Record<string, number> = {};
  const halfGrowth: Record<string, number> = {};

  for (const [kw, values] of Object.entries(series)) {
    const sum = values.reduce((a, b) => a + b, 0);
    averages[kw] = values.length > 0 ? sum / values.length : 0;

    // Split into first half and second half to measure internal trend
    const mid = Math.floor(values.length / 2);
    if (mid > 0) {
      const firstHalf = values.slice(0, mid);
      const secondHalf = values.slice(mid);
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      halfGrowth[kw] = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
    } else {
      halfGrowth[kw] = 0;
    }
  }

  return { averages, halfGrowth };
}

// ── Derive keywords from profile + sector ─────────────────────────────────────

function deriveKeywords(profile: ElevayAgentProfile, sector: string): string[] {
  const base = [profile.primary_keyword, profile.secondary_keyword];
  // Extraire des termes du secteur (mots ≥ 3 chars, max 3)
  const sectorTerms = sector
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .slice(0, 3);
  // Dédupliquer
  const all = [...new Set([...base, ...sectorTerms].map((k) => k.trim()).filter(Boolean))];
  return all.slice(0, 5);
}

// ── Classification ────────────────────────────────────────────────────────────

function classify(trend: KeywordTrend): "rising" | "stable" | "declining" {
  if (trend.growth_30d > 30) return "rising";
  if (trend.growth_30d >= -10) return "stable";
  return "declining";
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function fetchTrends(
  profile: ElevayAgentProfile,
  sector: string,
  priority_channels?: string[],
): Promise<ModuleResult<TrendsData>> {
  const cacheKey = `trends:${profile.country}:${profile.primary_keyword}:${sector}`;
  const cached = trendsCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < TRENDS_CACHE_TTL) {
    return { success: true, data: cached.data, source: "trends-cache" };
  }

  try {
    const keywords = deriveKeywords(profile, sector);
    const geoCode = profile.country.slice(0, 2).toUpperCase();

    // 2 appels Google Trends en parallèle (30j + 90j)
    const [trends30, trends90] = await Promise.all([
      fetchGoogleTrends(keywords, geoCode, "today 1-m"),
      fetchGoogleTrends(keywords, geoCode, "today 3-m"),
    ]);
    const avg30 = trends30.averages;
    const avg90 = trends90.averages;
    const half30Growth = trends30.halfGrowth;

    // DataForSEO pour volume + difficulté (uniquement si SEO actif)
    const runSeo = shouldRunSEO(priority_channels);
    const kwDataResults = runSeo
      ? await Promise.allSettled(keywords.map((kw) => getKeywordData(kw, profile.country)))
      : keywords.map(() => ({ status: "rejected" as const, reason: "skipped" }));

    const trends: KeywordTrend[] = keywords.map((kw, i) => {
      const kwResult = kwDataResults[i];
      const volume = kwResult.status === "fulfilled" ? kwResult.value.rank ?? 0 : 0;
      const difficulty = kwResult.status === "fulfilled"
        ? Math.min(100, Math.round((kwResult.value.referring_domains ?? 0) / 100))
        : 0;

      const mean30 = avg30[kw] ?? 0;
      const mean90 = avg90[kw] ?? 0;
      // growth_90d: how 30d average compares to 90d average (recent momentum)
      const growth_90d = mean90 > 0 ? ((mean30 - mean90) / mean90) * 100 : 0;
      // growth_30d: use the 30d series internal trend (first half vs second half)
      const growth_30d = half30Growth[kw] ?? 0;

      return { keyword: kw, volume, difficulty, growth_30d, growth_90d };
    });

    // GNews — extraire les press_themes
    const newsResult = await searchNews(`${sector} ${profile.primary_keyword}`, profile.language)
      .catch(() => null);
    const articles = newsResult?.articles ?? newsResult?.news_results ?? [];
    const press_themes = [...new Set(
      articles.slice(0, 10).map((a) => a.title).filter(Boolean),
    )].slice(0, 8);

    const rising = trends.filter((t) => classify(t) === "rising");
    const stable = trends.filter((t) => classify(t) === "stable");
    const declining = trends.filter((t) => classify(t) === "declining");

    const data: TrendsData = {
      rising_keywords: rising,
      stable_keywords: stable,
      declining_keywords: declining,
      press_themes,
    };

    trendsCache.set(cacheKey, { data, cachedAt: Date.now() });

    return { success: true, data, source: "serpapi-google-trends+dataforseo" };
  } catch (err) {
    return {
      success: false,
      data: null,
      source: "trends",
      error: {
        code: "MODULE_FETCH_FAILED",
        message: err instanceof Error ? err.message : "Trends fetch failed",
      },
      degraded: true,
    };
  }
}
