import type { AgentOutput } from "../_shared/types";
import type { CiaInput, CiaOutput } from "./types";
import { score } from "./scoring";
import { SYSTEM_PROMPT } from "./prompt";
import { analyzeProductMessaging } from "./modules/product-messaging";
import { analyzeSeoAcquisition } from "./modules/seo-acquisition";
import { analyzeSocialMedia } from "./modules/social-media";
import { analyzeContent } from "./modules/content";
import { analyzeBenchmark } from "./modules/benchmark";
import { buildRecommendations } from "./modules/recommendations";

export const CIA_PROFILE = {
  id: "cia-03",
  name: "Comprehensive Intelligence & Action",
  description: "Full-stack marketing intelligence: messaging, SEO, social, content, benchmarks, and recommendations.",
  version: "0.1.0",
} as const;

export { SYSTEM_PROMPT };

export async function run(input: CiaInput): Promise<AgentOutput<CiaOutput>> {
  const [productMessaging, seoAcquisition, socialMedia, content, benchmark] = await Promise.all([
    analyzeProductMessaging(input),
    analyzeSeoAcquisition(input),
    analyzeSocialMedia(input),
    analyzeContent(input),
    analyzeBenchmark(input),
  ]);

  const recommendations = await buildRecommendations({
    productMessaging,
    seoAcquisition,
    socialMedia,
    content,
    benchmark,
  });

  const output: CiaOutput = { productMessaging, seoAcquisition, socialMedia, content, benchmark, recommendations };
  const ciaScore = score(output);

  return {
    agent: CIA_PROFILE,
    results: [
      { module: "product-messaging", data: productMessaging, score: ciaScore.breakdown.messagingClarity, fetchedAt: new Date() },
      { module: "seo-acquisition", data: seoAcquisition, score: ciaScore.breakdown.seoReadiness, fetchedAt: new Date() },
      { module: "social-media", data: socialMedia, score: ciaScore.breakdown.socialPresence, fetchedAt: new Date() },
      { module: "content", data: content, score: ciaScore.breakdown.contentMaturity, fetchedAt: new Date() },
      { module: "benchmark", data: benchmark, score: ciaScore.breakdown.competitivePosition, fetchedAt: new Date() },
      { module: "recommendations", data: recommendations, score: ciaScore.overall, fetchedAt: new Date() },
    ],
    output,
    globalScore: ciaScore.overall,
    summary: `Full marketing intelligence report complete for "${input.product}". Overall score: ${ciaScore.overall}/100.`,
    generatedAt: new Date(),
  };
}
