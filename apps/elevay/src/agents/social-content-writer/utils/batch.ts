import type { ContentBrief, GenerationOutput } from "../core/types"

/**
 * Check if two briefs are about the same topic (for dedup/reuse).
 */
export function areSimilarTopics(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3)

  const wordsA = new Set(normalize(a))
  const wordsB = new Set(normalize(b))

  if (wordsA.size === 0 || wordsB.size === 0) return false

  const overlap = [...wordsA].filter((w) => wordsB.has(w)).length
  const similarity = overlap / Math.min(wordsA.size, wordsB.size)

  return similarity > 0.5
}

/**
 * Group briefs by similar topic for batch processing.
 * Briefs in the same group can share hashtag lookups.
 */
export function groupByTopic(
  briefs: ContentBrief[],
): ContentBrief[][] {
  const groups: ContentBrief[][] = []

  for (const brief of briefs) {
    const existingGroup = groups.find((g) =>
      areSimilarTopics(g[0].sourceContent, brief.sourceContent),
    )
    if (existingGroup) {
      existingGroup.push(brief)
    } else {
      groups.push([brief])
    }
  }

  return groups
}
