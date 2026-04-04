import type { ModuleResult } from "../_shared/types";
import type {
  SerpData,
  PressData,
  YoutubeData,
  SocialData,
  SeoData,
  BenchmarkData,
  GoogleMapsData,
  TrustpilotData,
} from "./types";

export interface BpiScores {
  global: number
  serp: number
  press: number
  youtube: number
  social: number
  seo: number
  benchmark: number
  completeness: number // 0.0–1.0 ratio of modules that returned data
}

interface ScoredComponent {
  name: keyof Omit<BpiScores, 'completeness'>
  weight: number
  score: number | null // null = source indisponible
}

/** Moyenne pondérée sur les sources disponibles */
function weightedMean(
  entries: { score: number; weight: number }[],
): number | null {
  if (entries.length === 0) return null;
  const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
  if (totalWeight === 0) return null;
  return Math.round(
    entries.reduce((s, e) => s + e.score * e.weight, 0) / totalWeight,
  );
}

/** Convertit le sentiment presse en score 0-100 */
function pressToScore(data: PressData): number {
  const countBase =
    data.article_count >= 50
      ? 85
      : data.article_count >= 20
        ? 65
        : data.article_count >= 5
          ? 45
          : 20;

  const sentimentDelta =
    data.sentiment === "positive"
      ? 15
      : data.sentiment === "mixed"
        ? 0
        : data.sentiment === "neutral"
          ? -5
          : -25;

  return Math.min(100, Math.max(0, countBase + sentimentDelta));
}

/**
 * calculateBpiScores — 6 axes directs
 *
 * Pondération globale :
 *   SERP        20% — visibility + reputation + Google Maps + Trustpilot
 *   Presse      15% — pressToScore
 *   YouTube     15% — reputation_score
 *   Social      15% — social_score
 *   SEO         20% — seo_score
 *   Benchmark   15% — competitive_score
 *
 * Mode dégradé : si un axe est null, son poids est redistribué
 * proportionnellement sur les autres.
 */
export function calculateBpiScores(results: {
  serp: ModuleResult<SerpData> | null
  press: ModuleResult<PressData> | null
  youtube: ModuleResult<YoutubeData> | null
  social: ModuleResult<SocialData> | null
  seo: ModuleResult<SeoData> | null
  benchmark: ModuleResult<BenchmarkData> | null
  googleMaps?: ModuleResult<GoogleMapsData> | null
  trustpilot?: ModuleResult<TrustpilotData> | null
}): BpiScores {
  const { serp, press, youtube, social, seo, benchmark, googleMaps, trustpilot } = results;

  // Completeness: count how many of the 8 modules returned data
  const totalModules = 8;
  const filledModules = [serp, press, youtube, social, seo, benchmark, googleMaps, trustpilot]
    .filter((m) => m?.data != null).length;
  const completeness = Math.round((filledModules / totalModules) * 100) / 100;

  // ── SERP (20%) — blend visibility + reputation + avis ──────────────────────
  let serpScore: number | null = null;
  if (serp?.data) {
    const serpSources: { score: number; weight: number }[] = [
      { score: serp.data.visibility_score, weight: 40 },
      { score: serp.data.reputation_score, weight: 40 },
    ];
    if (googleMaps?.data?.found && googleMaps.data.reputation_score !== undefined) {
      serpSources.push({ score: googleMaps.data.reputation_score, weight: 10 });
    }
    if (trustpilot?.data?.found && trustpilot.data.rating !== undefined) {
      serpSources.push({ score: Math.round((trustpilot.data.rating / 5) * 100), weight: 10 });
    }
    serpScore = weightedMean(serpSources);
  }

  // ── Presse (15%) ───────────────────────────────────────────────────────────
  const pressScore = press?.data ? pressToScore(press.data) : null;

  // ── YouTube (15%) ──────────────────────────────────────────────────────────
  const youtubeScore = youtube?.data ? youtube.data.reputation_score : null;

  // ── Social (15%) ───────────────────────────────────────────────────────────
  const socialScore = social?.data ? social.data.social_score : null;

  // ── SEO (20%) ──────────────────────────────────────────────────────────────
  const seoScore = seo?.data ? seo.data.seo_score : null;

  // ── Benchmark (15%) ────────────────────────────────────────────────────────
  const benchmarkScore = benchmark?.data ? benchmark.data.competitive_score : null;

  // ── Score global avec redistribution des poids ─────────────────────────────
  const components: ScoredComponent[] = [
    { name: "serp",      weight: 20, score: serpScore },
    { name: "press",     weight: 15, score: pressScore },
    { name: "youtube",   weight: 15, score: youtubeScore },
    { name: "social",    weight: 15, score: socialScore },
    { name: "seo",       weight: 20, score: seoScore },
    { name: "benchmark", weight: 15, score: benchmarkScore },
  ];

  const available = components.filter((c) => c.score !== null);
  const totalAvailableWeight = available.reduce((s, c) => s + c.weight, 0);

  const global =
    totalAvailableWeight > 0
      ? Math.round(
          available.reduce((s, c) => s + c.score! * c.weight, 0) /
            totalAvailableWeight,
        )
      : 0;

  return {
    global,
    serp:      serpScore ?? 0,
    press:     pressScore ?? 0,
    youtube:   youtubeScore ?? 0,
    social:    socialScore ?? 0,
    seo:       seoScore ?? 0,
    benchmark: benchmarkScore ?? 0,
    completeness,
  };
}
