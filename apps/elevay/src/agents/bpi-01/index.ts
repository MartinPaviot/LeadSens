import type { AgentOutput } from "../_shared/types";
import type { BpiInput, BpiOutput } from "./types";
import { score } from "./scoring";
import { SYSTEM_PROMPT } from "./prompt";
import { fetchSerp } from "./modules/serp";
import { fetchPress } from "./modules/press";
import { fetchYoutube } from "./modules/youtube";
import { fetchSocial } from "./modules/social";
import { fetchSeo } from "./modules/seo";
import { fetchBenchmark } from "./modules/benchmark";

export const BPI_PROFILE = {
  id: "bpi-01",
  name: "Brand & Market Intelligence",
  description: "Comprehensive brand perception analysis across SERP, press, YouTube, social, SEO, and benchmarks.",
  version: "0.1.0",
} as const;

export { SYSTEM_PROMPT };

export async function run(input: BpiInput): Promise<AgentOutput<BpiOutput>> {
  const [serp, press, youtube, social, seo, benchmark] = await Promise.all([
    fetchSerp(input.brand),
    fetchPress(input.brand),
    fetchYoutube(input.brand),
    fetchSocial(input.brand),
    fetchSeo(input.brand),
    fetchBenchmark(input.brand, input.competitors),
  ]);

  const output: BpiOutput = { serp, press, youtube, social, seo, benchmark };
  const bpiScore = score(output);

  return {
    agent: BPI_PROFILE,
    results: [
      { module: "serp", data: serp, score: bpiScore.breakdown.serpPresence, fetchedAt: new Date() },
      { module: "press", data: press, score: bpiScore.breakdown.pressVisibility, fetchedAt: new Date() },
      { module: "youtube", data: youtube, score: 0, fetchedAt: new Date() },
      { module: "social", data: social, score: bpiScore.breakdown.socialSentiment, fetchedAt: new Date() },
      { module: "seo", data: seo, score: bpiScore.breakdown.seoStrength, fetchedAt: new Date() },
      { module: "benchmark", data: benchmark, score: bpiScore.breakdown.competitivePosition, fetchedAt: new Date() },
    ],
    output,
    globalScore: bpiScore.overall,
    summary: `Brand intelligence analysis complete for "${input.brand}". Overall score: ${bpiScore.overall}/100.`,
    generatedAt: new Date(),
  };
}
