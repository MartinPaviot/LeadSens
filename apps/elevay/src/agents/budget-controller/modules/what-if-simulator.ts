import type {
  BudgetConfig,
  ChannelMetrics,
  ChannelAdjustment,
  WhatIfScenario,
  WhatIfProjectedImpact,
} from "../core/types"
import { DIMINISHING_RETURNS_COEFF } from "../core/constants"
import { calculateHealthScore } from "./health-scorer"

/**
 * Simulate the impact of budget reallocations.
 * Uses proportional calculation with diminishing returns coefficient.
 */
export function simulateWhatIf(
  config: BudgetConfig,
  currentMetrics: ChannelMetrics[],
  adjustments: ChannelAdjustment[],
): WhatIfScenario {
  const description = adjustments
    .map(
      (a) =>
        `${a.channel} ${a.changePercent > 0 ? "+" : ""}${a.changePercent}%`,
    )
    .join(", ")

  // Build projected metrics
  let totalNewLeads = 0
  let totalNewSpend = 0
  let totalNewRevenue = 0

  for (const m of currentMetrics) {
    const adjustment = adjustments.find((a) => a.channel === m.channel)
    const changeFactor = adjustment
      ? 1 + (adjustment.changePercent / 100) * DIMINISHING_RETURNS_COEFF
      : 1

    const newSpend = m.spend * changeFactor
    const newLeads = m.leads * changeFactor
    const newRevenue = m.revenue * changeFactor

    totalNewSpend += newSpend
    totalNewLeads += newLeads
    totalNewRevenue += newRevenue
  }

  const currentTotalLeads = currentMetrics.reduce((s, m) => s + m.leads, 0)
  const currentTotalSpend = currentMetrics.reduce((s, m) => s + m.spend, 0)
  const currentTotalRevenue = currentMetrics.reduce(
    (s, m) => s + m.revenue,
    0,
  )

  const newCac = totalNewLeads > 0 ? totalNewSpend / totalNewLeads : 0
  const currentCac =
    currentTotalLeads > 0 ? currentTotalSpend / currentTotalLeads : 0

  // Project new channel metrics for health score calculation
  const projectedMetrics: ChannelMetrics[] = currentMetrics.map((m) => {
    const adj = adjustments.find((a) => a.channel === m.channel)
    const factor = adj
      ? 1 + (adj.changePercent / 100) * DIMINISHING_RETURNS_COEFF
      : 1
    return {
      ...m,
      spend: m.spend * factor,
      leads: m.leads * factor,
      revenue: m.revenue * factor,
      cac: m.leads * factor > 0 ? (m.spend * factor) / (m.leads * factor) : m.cac,
      roi: m.spend * factor > 0 ? (m.revenue * factor) / (m.spend * factor) : m.roi,
    }
  })

  const newHealth = calculateHealthScore(config, projectedMetrics)

  const impact: WhatIfProjectedImpact = {
    leadsChange: Math.round(totalNewLeads - currentTotalLeads),
    cacChange: Math.round((newCac - currentCac) * 100) / 100,
    revenueChange: Math.round(totalNewRevenue - currentTotalRevenue),
    newHealthScore: newHealth.total,
    budgetCompliance: totalNewSpend <= config.annualBudget / 12,
  }

  return { description, adjustments, projectedImpact: impact }
}
