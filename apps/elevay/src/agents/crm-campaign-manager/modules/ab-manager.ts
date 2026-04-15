import type { ABConfig, ABResult, CampaignMetrics } from "../core/types"
import { MIN_AB_SAMPLE_SIZE } from "../core/constants"

export interface ABSplit {
  sampleA: string[] // contact IDs
  sampleB: string[]
  remainder: string[]
}

/**
 * Split a contact list for A/B testing.
 */
export function splitForAB(
  contactIds: string[],
  config: ABConfig,
): ABSplit | null {
  if (!config.enabled) return null
  if (contactIds.length < MIN_AB_SAMPLE_SIZE) return null

  const sampleCount = Math.floor(
    (contactIds.length * config.sampleSize) / 100,
  )
  const halfSample = Math.floor(sampleCount / 2)

  // Shuffle contacts for random assignment
  const shuffled = [...contactIds].sort(() => Math.random() - 0.5)

  return {
    sampleA: shuffled.slice(0, halfSample),
    sampleB: shuffled.slice(halfSample, sampleCount),
    remainder: shuffled.slice(sampleCount),
  }
}

/**
 * Evaluate A/B test results and determine winner.
 */
export function evaluateAB(
  metricsA: CampaignMetrics,
  metricsB: CampaignMetrics,
  winCriteria: ABConfig["winCriteria"],
): ABResult {
  const criteriaMap: Record<
    ABConfig["winCriteria"],
    keyof CampaignMetrics
  > = {
    open_rate: "openRate",
    click_rate: "clickRate",
    conversion: "conversions",
  }

  const key = criteriaMap[winCriteria]
  const valueA = metricsA[key]
  const valueB = metricsB[key]

  const winner: "A" | "B" = valueA >= valueB ? "A" : "B"
  const diff = Math.abs(valueA - valueB)

  return {
    winner,
    variantAMetrics: metricsA as unknown as Record<string, number>,
    variantBMetrics: metricsB as unknown as Record<string, number>,
    justification: `Variant ${winner} wins on ${winCriteria}: ${winner === "A" ? valueA : valueB} vs ${winner === "A" ? valueB : valueA} (diff: ${diff.toFixed(2)})`,
  }
}
