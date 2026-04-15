import { callLLM } from "@/agents/_shared/llm"
import type {
  WeeklyReport,
  PlatformMetrics,
  ReportAction,
  ReportRecommendation,
} from "../core/types"
import { getReportPrompt } from "../core/prompts"
import { checkThresholds, triggerActions } from "./optimizer"
import type { CampaignStructure } from "../core/types"

// ── LLM Response Validation ────────────────────────────

interface ReportLLMResponse {
  summary: string
  recommendations: Array<{
    priority: string
    action: string
    expectedImpact: string
  }>
  actions: Array<{
    type: string
    campaign: string
    reason: string
    impact: string
  }>
}

function isReportResponse(v: unknown): v is ReportLLMResponse {
  if (!v || typeof v !== "object") return false
  const obj = v as Record<string, unknown>
  return (
    typeof obj["summary"] === "string" &&
    Array.isArray(obj["recommendations"])
  )
}

// ── Report Generation ──────────────────────────────────

/**
 * Generate a weekly performance report using LLM analysis.
 */
export async function generateWeeklyReport(
  week: string, // ISO week: YYYY-Www
  metrics: PlatformMetrics[],
  campaigns: CampaignStructure[],
  language: string = "en",
): Promise<WeeklyReport> {
  // Run threshold checks
  const alerts = checkThresholds(metrics)
  const optimizerActions = triggerActions(alerts, campaigns)

  // Build context for LLM
  const metricsContext = metrics
    .map(
      (m) =>
        `${m.platform}: spend=${m.spend}EUR, impressions=${m.impressions}, clicks=${m.clicks}, conversions=${m.conversions}, CTR=${m.ctr}%, CPC=${m.cpc}EUR, CPA=${m.cpa}EUR, ROAS=${m.roas}x`,
    )
    .join("\n")

  const alertContext =
    alerts.length > 0
      ? `\nALERTS:\n${alerts.map((a) => `- ${a.platform} ${a.metric}: ${a.value}${a.unit} (${a.level})`).join("\n")}`
      : "\nNo threshold alerts."

  const response = await callLLM({
    system: getReportPrompt(language),
    user: `Week: ${week}\n\nMetrics:\n${metricsContext}${alertContext}\n\nActive campaigns: ${campaigns.filter((c) => c.status === "active").length}\nTotal campaigns: ${campaigns.length}`,
    maxTokens: 2048,
    temperature: 0.3,
  })

  // Compute aggregates
  const totalSpend = metrics.reduce((sum, m) => sum + m.spend, 0)
  const totalConversions = metrics.reduce((sum, m) => sum + m.conversions, 0)
  const totalRevenue = metrics.reduce(
    (sum, m) => sum + m.spend * m.roas,
    0,
  )
  const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0

  // Merge optimizer actions with LLM recommendations
  const actionsExecuted: ReportAction[] = optimizerActions.map((a) => ({
    type: a.type as ReportAction["type"],
    campaign: a.campaignName,
    reason: a.reason,
    impact: a.suggestedChange ?? "Pending",
  }))

  let recommendations: ReportRecommendation[] = []
  if (isReportResponse(response.parsed)) {
    recommendations = response.parsed.recommendations.map((r) => ({
      priority: r.priority as ReportRecommendation["priority"],
      action: r.action,
      expectedImpact: r.expectedImpact,
    }))

    // Add LLM-suggested actions
    if (response.parsed.actions) {
      for (const a of response.parsed.actions) {
        actionsExecuted.push({
          type: a.type as ReportAction["type"],
          campaign: a.campaign,
          reason: a.reason,
          impact: a.impact,
        })
      }
    }
  }

  return {
    week,
    platforms: metrics,
    actionsExecuted,
    recommendations,
    totalSpend,
    totalConversions,
    overallRoas: Math.round(overallRoas * 100) / 100,
  }
}
