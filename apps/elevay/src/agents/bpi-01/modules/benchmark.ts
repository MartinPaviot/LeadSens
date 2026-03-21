import type { ElevayAgentProfile, ModuleResult } from "../../_shared/types";
import type { BenchmarkData, CompetitorRadarEntry, ReviewData } from "../types";

/**
 * Module 6 — Benchmark concurrentiel & Réputation
 * Sources : Réutilisation données modules 1-5 + Google Maps API + Trustpilot scraping
 * Règle absolue : 0 appel API supplémentaire pour les données déjà collectées
 * Retry : ×0 — réutilise les données disponibles
 *
 * Note V1 : ce module reçoit uniquement le profil (données SERP/SEO passées en V2
 * via un contexte partagé). Les scores radar sont calculés à partir des mocks cohérents.
 */
export async function fetchBenchmark(
  profile: ElevayAgentProfile,
  _competitorNames: string[],
): Promise<ModuleResult<BenchmarkData>> {
  try {
    // TODO: Réutiliser les sorties des modules 1-5 via contexte partagé (V2)
    // + Google Maps API (OAuth client) pour les avis
    // + Trustpilot scraping public

    const brand = profile.brand_name;

    // Radar : brand + concurrents sur 5 axes (SERP, presse, SEO, YouTube, social)
    const radar: CompetitorRadarEntry[] = [
      {
        name: brand,
        serp_share: 42,
        press_volume: 38,
        seo_score: 51,
        youtube_reach: 34,
        social_score: 54,
      },
      ...profile.competitors.map((c, i) => ({
        name: c.name,
        serp_share: 68 + i * 10,
        press_volume: 74 + i * 8,
        seo_score: 71 + i * 8,
        youtube_reach: 62 + i * 15,
        social_score: 78 + i * 5,
      })),
    ];

    const google_maps: ReviewData = {
      rating: 4.2,
      review_count: 47,
      sentiment: "positive",
    };

    // Trustpilot : profil non détecté pour cette marque (V1 courant)
    const trustpilot: ReviewData | null = null;

    const data: BenchmarkData = {
      competitive_score: 58,
      radar,
      google_maps,
      trustpilot,
    };

    return { success: true, data, source: "benchmark:maps+trustpilot+reuse" };
  } catch (err) {
    console.warn("[BPI-01][benchmark] Module dégradé :", err);
    return {
      success: false,
      data: null,
      source: "benchmark:maps+trustpilot+reuse",
      error: {
        code: "BENCHMARK_FETCH_FAILED",
        message: err instanceof Error ? err.message : "Erreur inconnue",
      },
      degraded: true,
    };
  }
}
