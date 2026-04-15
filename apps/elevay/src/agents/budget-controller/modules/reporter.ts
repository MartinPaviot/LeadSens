import { callLLM } from "@/agents/_shared/llm"
import type { HealthScore, ChannelMetrics, Alert } from "../core/types"
import { getReportPrompt } from "../core/prompts"

export interface BudgetReport {
  executiveSummary: string
  topActions: Array<{ action: string; impact: string; priority: string }>
  channelHighlights: Array<{
    channel: string
    status: string
    insight: string
  }>
  generatedAt: string
}

export async function generateReport(
  healthScore: HealthScore,
  channelMetrics: ChannelMetrics[],
  alerts: Alert[],
  language = "en",
): Promise<BudgetReport> {
  const channelSummary = channelMetrics
    .map(
      (m) =>
        `${m.channel}: spend=${m.spend}, ROI=${m.roi.toFixed(2)}, CAC=${m.cac.toFixed(0)}, status=${m.status}`,
    )
    .join("\n")

  const response = await callLLM({
    system: getReportPrompt(language),
    user: `Health score: ${healthScore.total}/100 (${healthScore.level}, trend: ${healthScore.trend})

Channels:
${channelSummary}

Active alerts: ${alerts.length} (${alerts.filter((a) => a.level === "critical").length} critical)

Generate the weekly budget report.`,
    maxTokens: 1500,
    temperature: 0.5,
  })

  const defaults: BudgetReport = {
    executiveSummary: `Budget health score: ${healthScore.total}/100 (${healthScore.level}). ${alerts.length} active alerts.`,
    topActions: [],
    channelHighlights: channelMetrics.map((m) => ({
      channel: m.channel,
      status: m.status,
      insight: `Spend: €${m.spend}, ROI: ${m.roi.toFixed(2)}x`,
    })),
    generatedAt: new Date().toISOString(),
  }

  if (response.parsed && typeof response.parsed === "object") {
    const p = response.parsed as Record<string, unknown>
    if (typeof p["executiveSummary"] === "string")
      defaults.executiveSummary = p["executiveSummary"]
    if (Array.isArray(p["topActions"]))
      defaults.topActions = p["topActions"] as BudgetReport["topActions"]
    if (Array.isArray(p["channelHighlights"]))
      defaults.channelHighlights = p[
        "channelHighlights"
      ] as BudgetReport["channelHighlights"]
  }

  return defaults
}
