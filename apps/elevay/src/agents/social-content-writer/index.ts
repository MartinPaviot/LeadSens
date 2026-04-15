import type {
  ContentBrief,
  BrandVoiceProfile,
  GenerationOutput,
} from "./core/types"
import { SCW_AGENT_CODE, SCW_VERSION } from "./core/constants"
import { generate } from "./modules/generator"
import { transform } from "./modules/cross-platform"

export interface SCWRunResult {
  agentCode: typeof SCW_AGENT_CODE
  version: typeof SCW_VERSION
  output: GenerationOutput
  durationMs: number
}

/**
 * Main orchestrator for the Social Content Writer agent.
 *
 * Flow: Brief → Analyze → Generate → (optional) Cross-Platform → Output
 */
export async function runSCW(
  brief: ContentBrief,
  voice: BrandVoiceProfile,
): Promise<SCWRunResult> {
  const startedAt = Date.now()

  let output: GenerationOutput

  if (brief.crossPlatform) {
    // Cross-platform mode: generate source → transform for all platforms
    const sourceOutput = await generate(
      { ...brief, platforms: [brief.platforms[0]], variationsCount: 1 },
      voice,
    )
    const sourceContent =
      brief.sourceContent || sourceOutput.variations[0]?.content || ""

    const crossVariations = await transform(
      sourceContent,
      brief.platforms,
      voice,
    )

    output = {
      brief,
      variations: crossVariations,
      crossPlatformSource: sourceContent,
      hashtagsUsed: [
        ...new Set(crossVariations.flatMap((v) => v.hashtags)),
      ],
      generatedAt: new Date().toISOString(),
    }
  } else {
    // Standard mode: generate for each platform
    output = await generate(brief, voice)
  }

  return {
    agentCode: SCW_AGENT_CODE,
    version: SCW_VERSION,
    output,
    durationMs: Date.now() - startedAt,
  }
}
