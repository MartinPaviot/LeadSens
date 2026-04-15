import { callLLM } from "@/agents/_shared/llm"
import type {
  BrandVoiceProfile,
  GeneratedVariation,
  Platform,
} from "../core/types"
import { getCrossPlatformSystemPrompt } from "../core/prompts"
import { PLATFORM_CONFIGS } from "../core/constants"

interface CrossPlatformVersion {
  content: string
  hashtags: string[]
  cta: string
  mediaSuggestions?: string[]
}

function isCrossResponse(
  v: unknown,
): v is { versions: Record<string, CrossPlatformVersion> } {
  if (!v || typeof v !== "object") return false
  const obj = v as Record<string, unknown>
  return typeof obj["versions"] === "object" && obj["versions"] !== null
}

/**
 * Transform a source post into adapted versions for multiple platforms.
 * All versions are generated in a single LLM call (batch optimization).
 */
export async function transform(
  sourceContent: string,
  platforms: Platform[],
  voice: BrandVoiceProfile,
  language = "en",
): Promise<GeneratedVariation[]> {
  const systemPrompt = getCrossPlatformSystemPrompt(voice, platforms, language)

  const response = await callLLM({
    system: systemPrompt,
    user: `Source post to adapt:\n\n${sourceContent}`,
    maxTokens: 4096,
    temperature: 0.6,
  })

  const variations: GeneratedVariation[] = []

  if (isCrossResponse(response.parsed)) {
    for (const platform of platforms) {
      const version = response.parsed.versions[platform]
      if (!version) continue

      const cfg = PLATFORM_CONFIGS[platform]
      variations.push({
        platform,
        format: "caption", // Cross-platform defaults to caption per platform
        variationIndex: 0,
        content: version.content,
        hashtags: version.hashtags ?? [],
        cta: version.cta ?? "",
        characterCount: version.content.length,
        characterLimit: cfg.characterLimit,
        mediaSuggestions: version.mediaSuggestions,
      })
    }
  }

  return variations
}
