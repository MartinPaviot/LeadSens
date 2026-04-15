import type { Platform } from "../core/types"
import { PLATFORM_CONFIGS } from "../core/constants"

/**
 * Validate content against platform character limit.
 * Returns the content truncated intelligently if over limit.
 */
export function enforceCharacterLimit(
  content: string,
  platform: Platform,
): { content: string; truncated: boolean } {
  const limit = PLATFORM_CONFIGS[platform].characterLimit
  if (content.length <= limit) {
    return { content, truncated: false }
  }

  // Truncate at last sentence boundary before limit
  const truncated = content.slice(0, limit)
  const lastSentence = truncated.lastIndexOf(". ")
  if (lastSentence > limit * 0.7) {
    return { content: truncated.slice(0, lastSentence + 1), truncated: true }
  }

  // Fallback: truncate at last word boundary
  const lastSpace = truncated.lastIndexOf(" ")
  if (lastSpace > limit * 0.8) {
    return { content: truncated.slice(0, lastSpace) + "...", truncated: true }
  }

  return { content: truncated + "...", truncated: true }
}
