import type { AgentOutput } from "../_shared/types";
import type { MtsInput, MtsOutput } from "./types";
import { score } from "./scoring";
import { SYSTEM_PROMPT } from "./prompt";
import { fetchTrends } from "./modules/trends";
import { fetchContent } from "./modules/content";
import { fetchCompetitive } from "./modules/competitive";
import { fetchSocialListening } from "./modules/social-listening";
import { synthesize } from "./modules/synthesis";

export const MTS_PROFILE = {
  id: "mts-02",
  name: "Market Trend Strategist",
  description: "Surfaces emerging trends, content opportunities, and competitive dynamics.",
  version: "0.1.0",
} as const;

export { SYSTEM_PROMPT };

export async function run(input: MtsInput): Promise<AgentOutput<MtsOutput>> {
  const [trends, content, competitive, socialListening] = await Promise.all([
    fetchTrends(input.topic, input.timeframe),
    fetchContent(input.topic, input.industry),
    fetchCompetitive(input.topic, input.industry),
    fetchSocialListening(input.topic, input.region),
  ]);

  const synthesis = await synthesize({ trends, content, competitive, socialListening });

  const output: MtsOutput = { trends, content, competitive, socialListening, synthesis };
  const mtsScore = score(output);

  return {
    agent: MTS_PROFILE,
    results: [
      { module: "trends", data: trends, score: mtsScore.breakdown.trendMomentum, fetchedAt: new Date() },
      { module: "content", data: content, score: mtsScore.breakdown.contentOpportunity, fetchedAt: new Date() },
      { module: "competitive", data: competitive, score: mtsScore.breakdown.competitiveGap, fetchedAt: new Date() },
      { module: "social-listening", data: socialListening, score: mtsScore.breakdown.socialRelevance, fetchedAt: new Date() },
      { module: "synthesis", data: synthesis, score: mtsScore.overall, fetchedAt: new Date() },
    ],
    output,
    globalScore: mtsScore.overall,
    summary: `Market trend analysis complete for "${input.topic}". Overall score: ${mtsScore.overall}/100.`,
    generatedAt: new Date(),
  };
}
