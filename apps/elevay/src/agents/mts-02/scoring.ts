import type { SynthesisData } from './types'

export function calculateMtsScore(synthesis: SynthesisData): number {
  const strongTrends = synthesis.trending_topics.filter(
    (t) => t.classification === 'strong_trend',
  ).length

  const gapScore = Math.min(synthesis.content_gap_map.length * 10, 40) // max 40pts
  const trendScore = Math.min(strongTrends * 15, 40) // max 40pts
  const formatScore = Math.min(synthesis.format_matrix.length * 5, 20) // max 20pts

  return Math.min(gapScore + trendScore + formatScore, 100)
}
