import type { AgentOutput, ElevayAgentProfile, ModuleResult } from "../_shared/types";
import type {
  CiaOutput,
  CiaSessionContext,
  ProductMessagingData,
  SeoAcquisitionData,
  SocialMediaData,
  ContentAnalysisData,
} from "./types";
import { SYSTEM_PROMPT } from "./prompt";
import { fetchProductMessaging } from "./modules/product-messaging";
import { fetchSeoAcquisition } from "./modules/seo-acquisition";
import { fetchSocialMedia } from "./modules/social-media";
import { fetchContentAnalysis } from "./modules/content";
import { fetchBenchmark } from "./modules/benchmark";
import { buildRecommendations } from "./modules/recommendations";

export { SYSTEM_PROMPT };

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractResult<T>(
  settled: PromiseSettledResult<ModuleResult<T>>,
  source: string,
  degraded: string[],
): ModuleResult<T> | null {
  if (settled.status === "fulfilled") {
    if (settled.value.degraded) degraded.push(source);
    return settled.value;
  }
  degraded.push(source);
  return null;
}

// ── run ───────────────────────────────────────────────────────────────────────

/**
 * Orchestre les 6 modules CIA-03.
 * M1-M4 en parallèle → M5 benchmark (pur calcul) → M6 recommandations (pur calcul).
 * Pas d'appel LLM ici — délégué à la route API.
 */
export async function run(
  profile: ElevayAgentProfile,
  context: CiaSessionContext,
): Promise<{
  agentOutput: AgentOutput<CiaOutput>
  moduleResults: {
    messaging:  ModuleResult<ProductMessagingData> | null
    seo:        ModuleResult<SeoAcquisitionData>   | null
    social:     ModuleResult<SocialMediaData>       | null
    content:    ModuleResult<ContentAnalysisData>  | null
  }
}> {
  const degraded_sources: string[] = [];

  // M1-M4 en parallèle
  const [messagingSettled, seoSettled, socialSettled, contentSettled] =
    await Promise.allSettled([
      fetchProductMessaging(profile),
      fetchSeoAcquisition(profile),
      fetchSocialMedia(profile),
      fetchContentAnalysis(profile),
    ]);

  const messagingResult = extractResult(messagingSettled, "product-messaging", degraded_sources);
  const seoResult       = extractResult(seoSettled,       "seo-acquisition",   degraded_sources);
  const socialResult    = extractResult(socialSettled,    "social-media",      degraded_sources);
  const contentResult   = extractResult(contentSettled,   "content",           degraded_sources);

  // M5 — benchmark (calcul pur)
  const benchmarkResult = fetchBenchmark(profile, {
    messaging: messagingResult,
    seo:       seoResult,
    social:    socialResult,
    content:   contentResult,
  });
  if (!benchmarkResult.success) degraded_sources.push("benchmark");

  // M6 — recommandations (calcul pur)
  const benchmarkData = benchmarkResult.data;
  const recoContext = benchmarkData
    ? buildRecommendations(
        benchmarkData.strategic_zones,
        benchmarkData.competitor_scores,
        context,
        context.priority_channels,
        contentResult?.data?.competitors[0]?.dominant_themes[0] ?? "contenu éducatif",
        messagingResult?.data?.competitors[0]?.dominant_angle ?? "ROI",
      )
    : null;

  // Construire le payload CiaOutput (raffiné par LLM dans la route)
  const payload: CiaOutput = {
    analysis_context:  context,
    competitor_scores: benchmarkData?.competitor_scores ?? [],
    strategic_zones:   benchmarkData?.strategic_zones ?? [],
    product_messaging: messagingResult?.data?.competitors ?? [],
    seo_data:          seoResult?.data ?? {
      brand_seo: {
        entity_url: profile.brand_url,
        domain_authority: 0,
        estimated_keywords: 0,
        estimated_traffic: 0,
        backlink_count: 0,
        serp_positions: {},
        has_google_ads: false,
        featured_snippets: 0,
        seo_score: 0,
      },
      competitors_seo: [],
    },
    social_matrix:  socialResult?.data?.competitors ?? [],
    content_gap_map: contentResult?.data?.editorial_gap_map ?? [],
    threats:         recoContext?.threats ?? [],
    opportunities:   recoContext?.opportunities ?? [],
    action_plan_60d: recoContext?.action_plan_template ?? [],
  };

  return {
    agentOutput: {
      agent_code:    "CIA-03",
      analysis_date: new Date().toISOString(),
      brand_profile: profile,
      payload,
      degraded_sources,
      version:       "1.0",
    },
    moduleResults: {
      messaging: messagingResult,
      seo:       seoResult,
      social:    socialResult,
      content:   contentResult,
    },
  };
}
