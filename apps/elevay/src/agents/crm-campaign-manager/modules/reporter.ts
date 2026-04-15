import { callLLM } from "@/agents/_shared/llm"
import type {
  CampaignReport,
  CampaignMetrics,
  ABResult,
} from "../core/types"
import { getReportPrompt } from "../core/prompts"
import { INDUSTRY_BENCHMARKS } from "../core/constants"

interface ReportLLMResponse {
  summary: string
  recommendations: string[]
  nextCampaignSuggestion?: {
    bestTiming: string
    segmentSuggestion: string
    formatSuggestion: string
  }
}

function isReportResponse(v: unknown): v is ReportLLMResponse {
  if (!v || typeof v !== "object") return false
  const obj = v as Record<string, unknown>
  return (
    typeof obj["summary"] === "string" &&
    Array.isArray(obj["recommendations"])
  )
}

export async function generateReport(params: {
  campaignId: string
  metrics: CampaignMetrics
  abResult?: ABResult
  historicalOpenRate: number
  language?: string
}): Promise<CampaignReport> {
  const language = params.language ?? "en"
  const benchmark = INDUSTRY_BENCHMARKS.default

  const response = await callLLM({
    system: getReportPrompt(language),
    user: `Campaign metrics:
- Open rate: ${(params.metrics.openRate * 100).toFixed(1)}%
- Click rate: ${(params.metrics.clickRate * 100).toFixed(1)}%
- Conversions: ${params.metrics.conversions}
- Revenue: $${params.metrics.revenue}
- Unsubscribes: ${params.metrics.unsubscribes}
- Bounce rate: ${(params.metrics.bounceRate * 100).toFixed(1)}%

Benchmark: Open rate ${(benchmark.openRate * 100).toFixed(1)}%, Click rate ${(benchmark.clickRate * 100).toFixed(1)}%
Historical open rate: ${(params.historicalOpenRate * 100).toFixed(1)}%
${params.abResult ? `A/B Result: ${params.abResult.justification}` : ""}`,
    maxTokens: 1024,
    temperature: 0.5,
  })

  let recommendations = [
    "Review subject line performance",
    "Consider segment refinement",
    "Test different send times",
  ]

  if (isReportResponse(response.parsed)) {
    recommendations = response.parsed.recommendations
  }

  return {
    campaignId: params.campaignId,
    metrics: params.metrics,
    benchmark: {
      openRate: benchmark.openRate,
      clickRate: benchmark.clickRate,
    },
    abResult: params.abResult,
    recommendations,
  }
}
