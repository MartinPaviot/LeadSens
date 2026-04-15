import type { PlatformMetrics, CampaignStructure } from "../core/types"
import { KPI_THRESHOLDS } from "../core/constants"

// ── Threshold Check Result ─────────────────────────────

export type AlertLevel = "ok" | "warning" | "critical"

export interface ThresholdAlert {
  platform: string
  metric: string
  value: number
  threshold: number
  level: AlertLevel
  unit: string
}

export interface OptimizerAction {
  type: "pause" | "scale" | "adjust-budget" | "alert"
  campaignName: string
  platform: string
  reason: string
  suggestedChange?: string
}

// ── Check Thresholds ───────────────────────────────────

/**
 * Check platform metrics against KPI thresholds.
 * Returns alerts for any breached thresholds.
 */
export function checkThresholds(
  metrics: PlatformMetrics[],
): ThresholdAlert[] {
  const alerts: ThresholdAlert[] = []

  for (const m of metrics) {
    for (const threshold of KPI_THRESHOLDS) {
      const value = getMetricValue(m, threshold.metric)
      if (value === null) continue

      // For CPC/CPA, "below" means the value exceeds the threshold (bad = high cost)
      const isInverted = threshold.metric === "CPC" || threshold.metric === "CPA"

      if (isInverted) {
        if (value > threshold.criticalBelow) {
          alerts.push({
            platform: m.platform,
            metric: threshold.metric,
            value,
            threshold: threshold.criticalBelow,
            level: "critical",
            unit: threshold.unit,
          })
        } else if (value > threshold.warningBelow) {
          alerts.push({
            platform: m.platform,
            metric: threshold.metric,
            value,
            threshold: threshold.warningBelow,
            level: "warning",
            unit: threshold.unit,
          })
        }
      } else {
        if (value < threshold.criticalBelow) {
          alerts.push({
            platform: m.platform,
            metric: threshold.metric,
            value,
            threshold: threshold.criticalBelow,
            level: "critical",
            unit: threshold.unit,
          })
        } else if (value < threshold.warningBelow) {
          alerts.push({
            platform: m.platform,
            metric: threshold.metric,
            value,
            threshold: threshold.warningBelow,
            level: "warning",
            unit: threshold.unit,
          })
        }
      }
    }
  }

  return alerts
}

// ── Trigger Actions ────────────────────────────────────

/**
 * Based on alerts, suggest automated actions for campaigns.
 */
export function triggerActions(
  alerts: ThresholdAlert[],
  campaigns: CampaignStructure[],
): OptimizerAction[] {
  const actions: OptimizerAction[] = []

  for (const alert of alerts) {
    const affectedCampaigns = campaigns.filter(
      (c) => c.platform === alert.platform && c.status === "active",
    )

    for (const campaign of affectedCampaigns) {
      if (alert.level === "critical") {
        actions.push({
          type: "pause",
          campaignName: campaign.name,
          platform: campaign.platform,
          reason: `${alert.metric} at ${alert.value}${alert.unit} (critical threshold: ${alert.threshold}${alert.unit})`,
          suggestedChange: "Pause campaign and review targeting/creatives",
        })
      } else if (alert.level === "warning") {
        actions.push({
          type: "adjust-budget",
          campaignName: campaign.name,
          platform: campaign.platform,
          reason: `${alert.metric} at ${alert.value}${alert.unit} (warning threshold: ${alert.threshold}${alert.unit})`,
          suggestedChange: "Reduce daily budget by 20% and monitor",
        })
      }
    }
  }

  // Also suggest scaling for well-performing campaigns
  const platformsWithIssues = new Set(alerts.map((a) => a.platform))
  const healthyCampaigns = campaigns.filter(
    (c) =>
      c.status === "active" && !platformsWithIssues.has(c.platform),
  )

  for (const campaign of healthyCampaigns) {
    if (campaign.type === "scaling" || campaign.type === "cold") {
      actions.push({
        type: "scale",
        campaignName: campaign.name,
        platform: campaign.platform,
        reason: "No threshold breaches detected — eligible for scaling",
        suggestedChange: "Increase daily budget by 15%",
      })
    }
  }

  return actions
}

// ── Helpers ────────────────────────────────────────────

function getMetricValue(
  metrics: PlatformMetrics,
  metricName: string,
): number | null {
  switch (metricName) {
    case "CTR":
      return metrics.ctr
    case "CPC":
      return metrics.cpc
    case "CPA":
      return metrics.cpa
    case "ROAS":
      return metrics.roas
    case "Conversion Rate":
      return metrics.clicks > 0
        ? (metrics.conversions / metrics.clicks) * 100
        : null
    default:
      return null
  }
}
