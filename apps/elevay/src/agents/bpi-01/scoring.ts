import type { ModuleResult } from "../_shared/types";
import type {
  SerpData,
  PressData,
  YoutubeData,
  SocialData,
  SeoData,
  BenchmarkData,
  GoogleMapsData,
} from "./types";

export interface BpiScores {
  global: number
  reputation: number
  visibility: number
  social: number
  competitive: number
  completeness: number // 0.0–1.0 ratio of modules that returned data
}

interface ScoredComponent {
  name: keyof BpiScores
  weight: number       // poids nominal (35 / 30 / 20 / 15)
  score: number | null // null = source indisponible
}

/** Moyenne pondérée sur les sources disponibles dans une composante */
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
 * calculateBpiScores — section 5.1 agentBPI-01.md
 *
 * Pondération nominale :
 *   Réputation         35% — SERP reputation + YouTube reputation + presse + avis (Maps/TP)
 *   Visibilité         30% — SERP visibility + SEO score + YouTube reach
 *   Présence sociale   20% — Social score
 *   Dominance compét.  15% — Benchmark competitive score
 *
 * Mode dégradé (section 5.3) : si une composante est null,
 * son poids est redistribué proportionnellement sur les autres.
 */
export function calculateBpiScores(results: {
  serp: ModuleResult<SerpData> | null
  press: ModuleResult<PressData> | null
  youtube: ModuleResult<YoutubeData> | null
  social: ModuleResult<SocialData> | null
  seo: ModuleResult<SeoData> | null
  benchmark: ModuleResult<BenchmarkData> | null
  googleMaps?: ModuleResult<GoogleMapsData> | null
}): BpiScores {
  const { serp, press, youtube, social, seo, benchmark, googleMaps } = results;

  // Completeness: count how many of the 7 modules returned data
  const totalModules = 7;
  const filledModules = [serp, press, youtube, social, seo, benchmark, googleMaps]
    .filter((m) => m?.data != null).length;
  const completeness = Math.round((filledModules / totalModules) * 100) / 100;

  // ── Réputation (35%) ────────────────────────────────────────────────
  const reputationSources: { score: number; weight: number }[] = [];

  if (serp?.data) {
    reputationSources.push({ score: serp.data.reputation_score, weight: 30 });
  }
  if (youtube?.data) {
    reputationSources.push({ score: youtube.data.reputation_score, weight: 30 });
  }
  if (press?.data) {
    reputationSources.push({ score: pressToScore(press.data), weight: 20 });
  }
  // Préférer le module Google Maps dédié si disponible, sinon fallback benchmark mocké
  if (googleMaps?.data?.found && googleMaps.data.reputation_score !== undefined) {
    reputationSources.push({ score: googleMaps.data.reputation_score, weight: 10 });
  } else if (benchmark?.data?.google_maps) {
    reputationSources.push({
      score: Math.round((benchmark.data.google_maps.rating / 5) * 100),
      weight: 10,
    });
  }
  if (benchmark?.data?.trustpilot) {
    reputationSources.push({
      score: Math.round((benchmark.data.trustpilot.rating / 5) * 100),
      weight: 10,
    });
  }

  // ── Visibilité (30%) ────────────────────────────────────────────────
  const visibilitySources: { score: number; weight: number }[] = [];

  if (serp?.data) {
    visibilitySources.push({ score: serp.data.visibility_score, weight: 40 });
  }
  if (seo?.data) {
    visibilitySources.push({ score: seo.data.seo_score, weight: 45 });
  }
  if (youtube?.data) {
    // YouTube reach : normalisé depuis video_count (0-50+ → 0-100)
    const youtubeReach = Math.min(100, Math.round((youtube.data.video_count / 50) * 100));
    visibilitySources.push({ score: youtubeReach, weight: 15 });
  }

  // ── Présence sociale (20%) ──────────────────────────────────────────
  const socialSources: { score: number; weight: number }[] = [];

  if (social?.data) {
    socialSources.push({ score: social.data.social_score, weight: 100 });
  }

  // ── Dominance concurrentielle (15%) ────────────────────────────────
  const competitiveSources: { score: number; weight: number }[] = [];

  if (benchmark?.data) {
    competitiveSources.push({ score: benchmark.data.competitive_score, weight: 100 });
  }

  // ── Calcul des 4 composantes ───────────────────────────────────────
  const reputation = weightedMean(reputationSources);
  const visibility = weightedMean(visibilitySources);
  const socialScore = weightedMean(socialSources);
  const competitive = weightedMean(competitiveSources);

  // ── Score global avec redistribution des poids (section 5.3) ──────
  const components: ScoredComponent[] = [
    { name: "reputation", weight: 35, score: reputation },
    { name: "visibility", weight: 30, score: visibility },
    { name: "social", weight: 20, score: socialScore },
    { name: "competitive", weight: 15, score: competitive },
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
    reputation: reputation ?? 0,
    visibility: visibility ?? 0,
    social: socialScore ?? 0,
    competitive: competitive ?? 0,
    completeness,
  };
}
