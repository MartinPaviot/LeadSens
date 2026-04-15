import type {
  BudgetConfig,
  ChannelMetrics,
  AnnualProjection,
} from "../core/types"

/**
 * Project end-of-year budget and revenue with 3 scenarios.
 */
export function projectAnnual(
  config: BudgetConfig,
  channelMetrics: ChannelMetrics[],
  monthsElapsed: number,
): AnnualProjection {
  const remainingMonths = Math.max(1, 12 - monthsElapsed)

  const currentSpend = channelMetrics.reduce((s, m) => s + m.spend, 0)
  const currentRevenue = channelMetrics.reduce((s, m) => s + m.revenue, 0)

  // Monthly run rate
  const monthlySpendRate =
    monthsElapsed > 0 ? currentSpend / monthsElapsed : currentSpend
  const monthlyRevenueRate =
    monthsElapsed > 0 ? currentRevenue / monthsElapsed : currentRevenue

  // Nominal: current trend continues
  const nominalSpend = currentSpend + monthlySpendRate * remainingMonths
  const nominalRevenue =
    currentRevenue + monthlyRevenueRate * remainingMonths

  // Optimistic: +15% improvement in efficiency
  const optimisticSpend = nominalSpend * 0.95
  const optimisticRevenue = nominalRevenue * 1.15

  // Pessimistic: -20% degradation
  const pessimisticSpend = nominalSpend * 1.10
  const pessimisticRevenue = nominalRevenue * 0.80

  return {
    currentSpend,
    projectedSpend: Math.round(nominalSpend),
    budgetAllocated: config.annualBudget,
    variance: Math.round(nominalSpend - config.annualBudget),
    revenueAchieved: Math.round(currentRevenue),
    revenueTarget: config.objectives.annualRevenue,
    scenarios: {
      optimistic: {
        spend: Math.round(optimisticSpend),
        revenue: Math.round(optimisticRevenue),
        healthScore: 85,
      },
      nominal: {
        spend: Math.round(nominalSpend),
        revenue: Math.round(nominalRevenue),
        healthScore: 65,
      },
      pessimistic: {
        spend: Math.round(pessimisticSpend),
        revenue: Math.round(pessimisticRevenue),
        healthScore: 40,
      },
    },
  }
}
