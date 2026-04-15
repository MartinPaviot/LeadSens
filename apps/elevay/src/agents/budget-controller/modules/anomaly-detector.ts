import type {
  BudgetConfig,
  ChannelMetrics,
  Alert,
  AlertType,
  AlertLevel,
} from "../core/types"
import { DECISION_TREE_RULES } from "../core/constants"

let alertCounter = 0
function nextAlertId(): string {
  return `alert_${Date.now()}_${++alertCounter}`
}

export function detectAnomalies(
  config: BudgetConfig,
  channelMetrics: ChannelMetrics[],
): Alert[] {
  const alerts: Alert[] = []

  for (const m of channelMetrics) {
    const channelBudget = config.channels.find(
      (c) => c.channel === m.channel,
    )
    if (!channelBudget) continue

    const budgetShare = channelBudget.annualBudget / config.annualBudget

    // Rule 1: Overspend
    if (m.spend > m.budgetAllocated * DECISION_TREE_RULES.OVERSPEND.threshold) {
      const overPercent = Math.round(
        ((m.spend - m.budgetAllocated) / m.budgetAllocated) * 100,
      )
      alerts.push(createAlert({
        channel: m.channel,
        type: "overspend",
        level: overPercent > 25 ? "critical" : "attention",
        message: `${m.channel} is ${overPercent}% over budget (${formatCurrency(m.spend)} / ${formatCurrency(m.budgetAllocated)})`,
        impact: `${formatCurrency(m.spend - m.budgetAllocated)} overspent this period`,
        recommendation: `Cap spending or reallocate from underperforming channels`,
        metrics: { spend: m.spend, budget: m.budgetAllocated, overPercent },
      }))
    }

    // Rule 2: Low ROI + high budget share → reduce
    if (
      m.roi < DECISION_TREE_RULES.LOW_ROI_HIGH_SPEND.roiThreshold &&
      budgetShare > DECISION_TREE_RULES.LOW_ROI_HIGH_SPEND.budgetShareThreshold
    ) {
      alerts.push(createAlert({
        channel: m.channel,
        type: "underperformance",
        level: "critical",
        message: `${m.channel} has ROI ${m.roi.toFixed(2)}x with ${(budgetShare * 100).toFixed(0)}% of total budget`,
        impact: `Low returns on ${(budgetShare * 100).toFixed(0)}% of budget`,
        recommendation: `Reduce ${m.channel} budget by 20-30% and reallocate to higher-performing channels`,
        metrics: { roi: m.roi, budgetShare, spend: m.spend },
      }))
    }

    // Rule 3: Scaling opportunity
    if (m.roi > config.kpiTargets.roiMinimum * DECISION_TREE_RULES.SCALING_OPPORTUNITY.roiMultiple) {
      alerts.push(createAlert({
        channel: m.channel,
        type: "scaling-opportunity",
        level: "opportunity",
        message: `${m.channel} has ROI ${m.roi.toFixed(2)}x — ${((m.roi / config.kpiTargets.roiMinimum) * 100).toFixed(0)}% above target`,
        impact: `High-performing channel with room to scale`,
        recommendation: `Increase ${m.channel} budget by 15-25% to capture additional growth`,
        metrics: { roi: m.roi, targetRoi: config.kpiTargets.roiMinimum },
      }))
    }

    // Rule 4: Underspend at mid-period
    if (m.spend < m.budgetAllocated * DECISION_TREE_RULES.UNDERSPEND.consumptionThreshold) {
      alerts.push(createAlert({
        channel: m.channel,
        type: "underspend",
        level: "attention",
        message: `${m.channel} has only used ${((m.spend / m.budgetAllocated) * 100).toFixed(0)}% of allocated budget`,
        impact: `Potential missed opportunities or execution issues`,
        recommendation: `Investigate if ${m.channel} campaigns are running as planned`,
        metrics: { spend: m.spend, budget: m.budgetAllocated },
      }))
    }

    // Rule 5: CAC too high
    if (m.cac > config.kpiTargets.cacTarget * 2) {
      alerts.push(createAlert({
        channel: m.channel,
        type: "cac-drift",
        level: "critical",
        message: `${m.channel} CAC is ${formatCurrency(m.cac)} — ${((m.cac / config.kpiTargets.cacTarget) * 100).toFixed(0)}% of target`,
        impact: `Unsustainable acquisition cost`,
        recommendation: `Review targeting and creative on ${m.channel}. Consider pausing underperforming campaigns.`,
        metrics: { cac: m.cac, cacTarget: config.kpiTargets.cacTarget },
      }))
    }
  }

  // Rule 6: Goal at risk (aggregate)
  const totalRevenue = channelMetrics.reduce((s, m) => s + m.revenue, 0)
  const monthlyTarget =
    config.objectives.annualRevenue / 12
  if (totalRevenue < monthlyTarget * 0.7) {
    alerts.push(createAlert({
      channel: "global",
      type: "goal-at-risk",
      level: "critical",
      message: `Revenue is at ${((totalRevenue / monthlyTarget) * 100).toFixed(0)}% of monthly target`,
      impact: `Annual revenue goal at risk if trend continues`,
      recommendation: `Review channel mix and consider increasing investment in top-performing channels`,
      metrics: { revenue: totalRevenue, target: monthlyTarget },
    }))
  }

  return alerts
}

function createAlert(params: {
  channel: string
  type: AlertType
  level: AlertLevel
  message: string
  impact: string
  recommendation: string
  metrics: Record<string, number>
}): Alert {
  return {
    id: nextAlertId(),
    ...params,
    createdAt: new Date().toISOString(),
    acknowledged: false,
  }
}

function formatCurrency(n: number): string {
  return `€${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}`
}
