import type { AgentOutput } from "../_shared/types";
import type { CiaInput, CiaOutput } from "./types";
import { SYSTEM_PROMPT } from "./prompt";
import { analyzeProductMessaging } from "./modules/product-messaging";
import { analyzeSeoAcquisition } from "./modules/seo-acquisition";
import { analyzeSocialMedia } from "./modules/social-media";
import { analyzeContent } from "./modules/content";
import { analyzeBenchmark } from "./modules/benchmark";
import { buildRecommendations } from "./modules/recommendations";

export { SYSTEM_PROMPT };

function extractResult<T>(
  result: PromiseSettledResult<T>,
  source: string,
  degraded: string[],
): T | null {
  if (result.status === "fulfilled") return result.value;
  degraded.push(source);
  return null;
}

export async function run(input: CiaInput): Promise<AgentOutput<CiaOutput>> {
  const [
    productMessagingResult,
    seoAcquisitionResult,
    socialMediaResult,
    contentResult,
    benchmarkResult,
  ] = await Promise.allSettled([
    analyzeProductMessaging(input),
    analyzeSeoAcquisition(input),
    analyzeSocialMedia(input),
    analyzeContent(input),
    analyzeBenchmark(input),
  ]);

  const degraded_sources: string[] = [];

  const productMessaging = extractResult(productMessagingResult, "product-messaging", degraded_sources);
  const seoAcquisition = extractResult(seoAcquisitionResult, "seo-acquisition", degraded_sources);
  const socialMedia = extractResult(socialMediaResult, "social-media", degraded_sources);
  const content = extractResult(contentResult, "content", degraded_sources);
  const benchmark = extractResult(benchmarkResult, "benchmark", degraded_sources);

  let recommendations = null;
  try {
    recommendations = await buildRecommendations({
      productMessaging,
      seoAcquisition,
      socialMedia,
      content,
      benchmark,
    });
  } catch {
    degraded_sources.push("recommendations");
  }

  return {
    agent_code: "CIA-03",
    analysis_date: new Date().toISOString(),
    brand_profile: input.brand_profile,
    payload: { productMessaging, seoAcquisition, socialMedia, content, benchmark, recommendations },
    degraded_sources,
    version: "1.0",
  };
}
