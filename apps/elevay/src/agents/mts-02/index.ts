import type { AgentOutput, ElevayAgentProfile, ModuleResult } from "../_shared/types";
import type { MtsOutput, MtsSessionContext, TrendsData, ContentPerformanceData, CompetitiveContentData, SocialListeningData } from "./types";
import { SYSTEM_PROMPT } from "./prompt";
import { fetchTrends } from "./modules/trends";
import { fetchContent } from "./modules/content";
import { fetchCompetitive } from "./modules/competitive";
import { fetchSocialListening } from "./modules/social-listening";
import { runSynthesis } from "./modules/synthesis";

export { SYSTEM_PROMPT };

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractResult<T>(
  result: PromiseSettledResult<ModuleResult<T>>,
  source: string,
  degraded: string[],
): ModuleResult<T> | null {
  if (result.status === "fulfilled") {
    if (result.value.degraded) degraded.push(source);
    return result.value;
  }
  degraded.push(source);
  return null;
}

// ── run ───────────────────────────────────────────────────────────────────────

/**
 * Orchestre les 5 modules MTS-02.
 * Modules 1-4 en parallèle → Module 5 (synthèse) après.
 * Pas d'appel LLM ici — délégué à la route API.
 */
export async function run(
  profile: ElevayAgentProfile,
  context: MtsSessionContext,
): Promise<{
  agentOutput: AgentOutput<MtsOutput>
  moduleResults: {
    trends: ModuleResult<TrendsData> | null
    content: ModuleResult<ContentPerformanceData> | null
    competitive: ModuleResult<CompetitiveContentData> | null
    socialListening: ModuleResult<SocialListeningData> | null
  }
}> {
  const degraded_sources: string[] = [];

  // Modules 1-4 en parallèle
  const [
    trendsSettled,
    competitiveSettled,
    socialListeningSettled,
  ] = await Promise.allSettled([
    fetchTrends(profile, context.sector),
    fetchCompetitive(profile, context.sector),
    fetchSocialListening(profile, context.sector),
  ]);

  const trendsResult = extractResult(trendsSettled, "trends", degraded_sources);
  const competitiveResult = extractResult(competitiveSettled, "competitive", degraded_sources);
  const socialListeningResult = extractResult(socialListeningSettled, "social-listening", degraded_sources);

  // Le module content dépend des keywords en croissance de trends
  const risingKeywords = trendsResult?.data?.rising_keywords ?? [];
  const contentSettled = await fetchContent(profile, risingKeywords)
    .then((r) => ({ status: "fulfilled" as const, value: r }))
    .catch((err: unknown) => ({ status: "rejected" as const, reason: err }));

  const contentResult = extractResult(
    contentSettled as PromiseSettledResult<ModuleResult<ContentPerformanceData>>,
    "content",
    degraded_sources,
  );

  // Module 5 — synthèse (pur calcul, sans API)
  const synthesis = runSynthesis({
    trends: trendsResult,
    content: contentResult,
    competitive: competitiveResult,
    socialListening: socialListeningResult,
  });

  // Construire le payload MtsOutput (roadmap_30d et trending_topics finaux générés par LLM dans la route)
  const payload: MtsOutput = {
    global_score: 0,  // calculé par la route après scoring
    sector: context.sector,
    analysis_period: new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
    mode: "ponctuel",
    session_context: context,
    trending_topics: synthesis.trending_topics,
    saturated_topics: synthesis.saturated_topics,
    content_gap_map: synthesis.content_gap_map,
    format_matrix: synthesis.format_matrix,
    social_signals: synthesis.social_signals,
    differentiating_angles: synthesis.differentiating_angles,
    roadmap_30d: [],  // rempli après appel LLM dans la route
    opportunity_scores: synthesis.opportunity_scores,
  };

  return {
    agentOutput: {
      agent_code: "MTS-02",
      analysis_date: new Date().toISOString(),
      brand_profile: profile,
      payload,
      degraded_sources,
      version: "1.0",
    },
    moduleResults: {
      trends: trendsResult,
      content: contentResult,
      competitive: competitiveResult,
      socialListening: socialListeningResult,
    },
  };
}
