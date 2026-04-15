import type {
  BudgetConfig,
  ChannelMetrics,
  HealthScore,
  HealthLevel,
  HealthTrend,
} from "../core/types"
import { HEALTH_SCORE_WEIGHTS, ALERT_LEVELS } from "../core/constants"

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getLevel(score: number): HealthLevel {
  if (score <= 40) return "critical"
  if (score <= 65) return "attention"
  if (score <= 80) return "ok"
  return "optimal"
}

export function calculateHealthScore(
  config: BudgetConfig,
  channelMetrics: ChannelMetrics[],
  previousScore?: number,
): HealthScore {
  if (channelMetrics.length === 0) {
    return {
      total: 50,
      level: "attention",
      components: {
        efficiency: 50,
        budgetCompliance: 100,
        goalAttainment: 0,
        cacControl: 50,
        stability: 50,
      },
      trend: "stable",
      calculatedAt: new Date().toISOString(),
    }
  }

  // 1. Efficiency: average ROI / target ROI
  const avgRoi =
    channelMetrics.reduce((s, m) => s + m.roi, 0) / channelMetrics.length
  const efficiency =
    config.kpiTargets.roiMinimum > 0
      ? clamp((avgRoi / config.kpiTargets.roiMinimum) * 100, 0, 100)
      : 50

  // 2. Budget compliance: channels within budget / total
  const withinBudget = channelMetrics.filter(
    (m) => m.spend <= m.budgetAllocated * 1.1,
  ).length
  const budgetCompliance = (withinBudget / channelMetrics.length) * 100

  // 3. Goal attainment: total leads / target
  const totalLeads = channelMetrics.reduce((s, m) => s + m.leads, 0)
  const goalAttainment =
    config.objectives.monthlyLeads > 0
      ? clamp((totalLeads / config.objectives.monthlyLeads) * 100, 0, 100)
      : 50

  // 4. CAC control: target / actual (capped at 1)
  const avgCac =
    channelMetrics.reduce((s, m) => s + m.cac, 0) / channelMetrics.length
  const cacControl =
    avgCac > 0
      ? clamp((config.kpiTargets.cacTarget / avgCac) * 100, 0, 100)
      : 50

  // 5. Stability: no drift over 4 weeks (simplified: compare to previous)
  const stability = previousScore
    ? Math.abs(previousScore - efficiency) < 10
      ? 100
      : 50
    : 75

  const components = {
    efficiency: Math.round(efficiency),
    budgetCompliance: Math.round(budgetCompliance),
    goalAttainment: Math.round(goalAttainment),
    cacControl: Math.round(cacControl),
    stability: Math.round(stability),
  }

  const total = Math.round(
    components.efficiency * HEALTH_SCORE_WEIGHTS.efficiency +
      components.budgetCompliance * HEALTH_SCORE_WEIGHTS.budgetCompliance +
      components.goalAttainment * HEALTH_SCORE_WEIGHTS.goalAttainment +
      components.cacControl * HEALTH_SCORE_WEIGHTS.cacControl +
      components.stability * HEALTH_SCORE_WEIGHTS.stability,
  )

  const trend: HealthTrend = previousScore
    ? total > previousScore + 3
      ? "improving"
      : total < previousScore - 3
        ? "declining"
        : "stable"
    : "stable"

  return {
    total: clamp(total, 0, 100),
    level: getLevel(total),
    components,
    trend,
    calculatedAt: new Date().toISOString(),
  }
}
