import type { AgentOutput } from "../_shared/types";
import type { MtsInput, MtsOutput } from "./types";
import { SYSTEM_PROMPT } from "./prompt";
import { fetchTrends } from "./modules/trends";
import { fetchContent } from "./modules/content";
import { fetchCompetitive } from "./modules/competitive";
import { fetchSocialListening } from "./modules/social-listening";
import { synthesize } from "./modules/synthesis";

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

export async function run(input: MtsInput): Promise<AgentOutput<MtsOutput>> {
  const [trendsResult, contentResult, competitiveResult, socialListeningResult] =
    await Promise.allSettled([
      fetchTrends(input.topic, input.timeframe),
      fetchContent(input.topic, input.industry),
      fetchCompetitive(input.topic, input.industry),
      fetchSocialListening(input.topic, input.region),
    ]);

  const degraded_sources: string[] = [];

  const trends = extractResult(trendsResult, "trends", degraded_sources);
  const content = extractResult(contentResult, "content", degraded_sources);
  const competitive = extractResult(competitiveResult, "competitive", degraded_sources);
  const socialListening = extractResult(socialListeningResult, "social-listening", degraded_sources);

  let synthesis = null;
  try {
    synthesis = await synthesize({ trends, content, competitive, socialListening });
  } catch {
    degraded_sources.push("synthesis");
  }

  return {
    agent_code: "MTS-02",
    analysis_date: new Date().toISOString(),
    brand_profile: input.brand_profile,
    payload: { trends, content, competitive, socialListening, synthesis },
    degraded_sources,
    version: "1.0",
  };
}
