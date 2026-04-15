import { callLLM } from "@/agents/_shared/llm"
import type { BudgetConfig, ChannelMetrics, Alert } from "../core/types"
import { getArbitragePrompt } from "../core/prompts"

export interface ArbitrageRecommendation {
  action: string
  channel: string
  changePercent: number
  justification: string
  expectedImpact: string
  priority: "high" | "medium" | "low"
}

interface ArbitrageLLMResponse {
  recommendations: ArbitrageRecommendation[]
}

function isArbitrageResponse(v: unknown): v is ArbitrageLLMResponse {
  if (!v || typeof v !== "object") return false
  const obj = v as Record<string, unknown>
  return Array.isArray(obj["recommendations"])
}

export async function generateArbitrageRecommendations(
  config: BudgetConfig,
  channelMetrics: ChannelMetrics[],
  alerts: Alert[],
  language = "en",
): Promise<ArbitrageRecommendation[]> {
  const channelSummary = channelMetrics
    .map(
      (m) =>
        `${m.channel}: spend=${m.spend}, budget=${m.budgetAllocated}, ROI=${m.roi.toFixed(2)}, CAC=${m.cac.toFixed(0)}, leads=${m.leads}, status=${m.status}`,
    )
    .join("\n")

  const alertSummary = alerts
    .map((a) => `[${a.level}] ${a.channel}: ${a.message}`)
    .join("\n")

  const response = await callLLM({
    system: getArbitragePrompt(language),
    user: `Budget: €${config.annualBudget}/year
KPI targets: CPL=${config.kpiTargets.cplTarget}, CAC=${config.kpiTargets.cacTarget}, ROI min=${config.kpiTargets.roiMinimum}

Channel metrics:
${channelSummary}

Active alerts:
${alertSummary || "None"}

Recommend budget reallocations.`,
    maxTokens: 1500,
    temperature: 0.5,
  })

  if (isArbitrageResponse(response.parsed)) {
    return response.parsed.recommendations
  }

  return []
}
