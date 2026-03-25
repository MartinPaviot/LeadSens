import type { AgentOutput, ElevayAgentProfile, ModuleResult } from "../_shared/types";
import type { BpiOutput } from "./types";
import { calculateBpiScores } from "./scoring";
import { SYSTEM_PROMPT } from "./prompt";
import { fetchSerp } from "./modules/serp";
import { fetchPress } from "./modules/press";
import { fetchYoutube } from "./modules/youtube";
import { fetchSocial } from "./modules/social";
import { fetchSeo } from "./modules/seo";
import { fetchBenchmark } from "./modules/benchmark";
import { fetchGoogleMapsReputation } from "./modules/google-maps";

export { SYSTEM_PROMPT };

/** Extrait un ModuleResult depuis un PromiseSettledResult.
 *  Si la promesse a rejeté (throw inattendu malgré la règle no-throw),
 *  on retourne null et on logue la source comme dégradée. */
function extractResult<T>(
  result: PromiseSettledResult<ModuleResult<T>>,
  source: string,
  degraded: string[],
): ModuleResult<T> | null {
  if (result.status === "fulfilled") {
    if (result.value.degraded) degraded.push(source);
    return result.value;
  }
  // Throw inattendu — filet de sécurité
  degraded.push(source);
  return null;
}

export async function run(profile: ElevayAgentProfile): Promise<AgentOutput<BpiOutput>> {
  const [
    serpSettled,
    pressSettled,
    youtubeSettled,
    socialSettled,
    seoSettled,
    benchmarkSettled,
    googleMapsSettled,
  ] = await Promise.allSettled([
    fetchSerp(profile),
    fetchPress(profile),
    fetchYoutube(profile),
    fetchSocial(profile),
    fetchSeo(profile),
    fetchBenchmark(profile, profile.competitors.map((c) => c.name)),
    fetchGoogleMapsReputation(profile),
  ]);

  const degraded_sources: string[] = [];

  const serpResult      = extractResult(serpSettled,       "serp",       degraded_sources);
  const pressResult     = extractResult(pressSettled,      "press",      degraded_sources);
  const youtubeResult   = extractResult(youtubeSettled,    "youtube",    degraded_sources);
  const socialResult    = extractResult(socialSettled,     "social",     degraded_sources);
  const seoResult       = extractResult(seoSettled,        "seo",        degraded_sources);
  const benchmarkResult = extractResult(benchmarkSettled,  "benchmark",  degraded_sources);
  const googleMapsResult = extractResult(googleMapsSettled, "gmaps",     degraded_sources);

  const scores = calculateBpiScores({
    serp:       serpResult,
    press:      pressResult,
    youtube:    youtubeResult,
    social:     socialResult,
    seo:        seoResult,
    benchmark:  benchmarkResult,
    googleMaps: googleMapsResult,
  });

  const payload: BpiOutput = {
    scores,
    serp_data:             serpResult?.data       ?? null,
    press_data:            pressResult?.data      ?? null,
    youtube_data:          youtubeResult?.data    ?? null,
    social_data:           socialResult?.data     ?? null,
    seo_data:              seoResult?.data        ?? null,
    benchmark_data:        benchmarkResult?.data  ?? null,
    googleMapsReputation:  googleMapsResult?.data ?? undefined,
    // Remplis par l'appel LLM consolidé (buildConsolidatedPrompt → callLlm)
    top_risks:   [],
    quick_wins:  [],
    roadmap_90d: [],
  };

  return {
    agent_code:    "BPI-01",
    analysis_date: new Date().toISOString(),
    brand_profile: profile,
    payload,
    degraded_sources,
    version:       "1.0",
  };
}
