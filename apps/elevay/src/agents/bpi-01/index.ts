import { callLLM } from "@/agents/_shared/llm"
import type { AgentProfile, AgentOutput } from "@/agents/_shared/types"
import { fetchSerp } from "./modules/serp"
import { fetchPress } from "./modules/press"
import { fetchYoutube } from "./modules/youtube"
import { fetchSocial } from "./modules/social"
import { fetchSeo } from "./modules/seo"
import { fetchBenchmark } from "./modules/benchmark"
import { fetchGoogleMaps } from "./modules/google-maps"
import { fetchTrustpilot } from "./modules/trustpilot"
import { calculateBpiScores } from "./scoring"
import { getSystemPrompt, buildConsolidatedPrompt } from "./prompt"
import type { BpiOutput, AxisDiagnostic, Priority90d } from "./types"

interface LlmBpiResponse {
  axis_diagnostics: AxisDiagnostic[]
  priorities_90d: Priority90d[]
}

function isLlmBpiResponse(v: unknown): v is LlmBpiResponse {
  if (!v || typeof v !== "object") return false
  const obj = v as Record<string, unknown>
  return (
    Array.isArray(obj["axis_diagnostics"]) &&
    Array.isArray(obj["priorities_90d"])
  )
}

export async function runBpi01(
  profile: AgentProfile,
): Promise<AgentOutput<BpiOutput>> {
  // 1. Run all 8 modules in parallel
  const [
    serpResult,
    pressResult,
    youtubeResult,
    socialResult,
    seoResult,
    benchmarkResult,
    googleMapsResult,
    trustpilotResult,
  ] = await Promise.allSettled([
    fetchSerp(profile),
    fetchPress(profile),
    fetchYoutube(profile),
    fetchSocial(profile),
    fetchSeo(profile),
    fetchBenchmark(profile),
    fetchGoogleMaps(profile),
    fetchTrustpilot(profile),
  ])

  // 2. Extract data and collect degraded sources
  const serp =
    serpResult.status === "fulfilled" ? serpResult.value.data : null
  const press =
    pressResult.status === "fulfilled" ? pressResult.value.data : null
  const youtube =
    youtubeResult.status === "fulfilled" ? youtubeResult.value.data : null
  const socialModule =
    socialResult.status === "fulfilled" ? socialResult.value : null
  const social = socialModule?.data ?? null
  const socialEnrichment =
    socialModule && "enrichment" in socialModule
      ? socialModule.enrichment
      : undefined
  const seo =
    seoResult.status === "fulfilled" ? seoResult.value.data : null
  const benchmark =
    benchmarkResult.status === "fulfilled"
      ? benchmarkResult.value.data
      : null
  const googleMaps =
    googleMapsResult.status === "fulfilled"
      ? googleMapsResult.value.data
      : null
  const trustpilot =
    trustpilotResult.status === "fulfilled"
      ? trustpilotResult.value.data
      : null

  const degradedSources: string[] = []
  if (
    serpResult.status === "fulfilled" &&
    (!serpResult.value.success || serpResult.value.degraded)
  )
    degradedSources.push("serp")
  if (serpResult.status === "rejected") degradedSources.push("serp")
  if (
    pressResult.status === "fulfilled" &&
    (!pressResult.value.success || pressResult.value.degraded)
  )
    degradedSources.push("press")
  if (pressResult.status === "rejected") degradedSources.push("press")
  if (
    youtubeResult.status === "fulfilled" &&
    (!youtubeResult.value.success || youtubeResult.value.degraded)
  )
    degradedSources.push("youtube")
  if (youtubeResult.status === "rejected") degradedSources.push("youtube")
  if (
    socialResult.status === "fulfilled" &&
    (!socialResult.value.success || socialResult.value.degraded)
  )
    degradedSources.push("social")
  if (socialResult.status === "rejected") degradedSources.push("social")
  if (
    seoResult.status === "fulfilled" &&
    (!seoResult.value.success || seoResult.value.degraded)
  )
    degradedSources.push("seo")
  if (seoResult.status === "rejected") degradedSources.push("seo")
  if (
    benchmarkResult.status === "fulfilled" &&
    (!benchmarkResult.value.success || benchmarkResult.value.degraded)
  )
    degradedSources.push("benchmark")
  if (benchmarkResult.status === "rejected")
    degradedSources.push("benchmark")

  // 3. Calculate scores
  const scores = calculateBpiScores({
    serp,
    press,
    youtube,
    social,
    seo,
    benchmark,
  })

  // 4. Build prompt and call LLM (1 single call)
  const llmResponse = await callLLM({
    system: getSystemPrompt(profile.language ?? "English"),
    user: buildConsolidatedPrompt(
      profile,
      scores,
      {
        serp,
        press,
        youtube,
        social,
        seo,
        benchmark,
        googleMaps,
        trustpilot,
      },
      socialEnrichment as Parameters<typeof buildConsolidatedPrompt>[3],
    ),
    maxTokens: 4096,
    temperature: 0.3,
  })

  // 5. Parse LLM response
  let axisDiagnostics: AxisDiagnostic[] = []
  let priorities90d: Priority90d[] = []
  let warning: string | undefined

  if (isLlmBpiResponse(llmResponse.parsed)) {
    axisDiagnostics = llmResponse.parsed.axis_diagnostics
    priorities90d = llmResponse.parsed.priorities_90d
  } else {
    warning =
      "AI analysis returned partial results — some diagnostics may be unavailable"
  }

  // 6. Assemble output
  const payload: BpiOutput = {
    scores,
    serp_data: serp,
    press_data: press,
    youtube_data: youtube,
    social_data: social,
    seo_data: seo,
    benchmark_data: benchmark,
    googleMapsReputation: googleMaps,
    trustpilot,
    axis_diagnostics: axisDiagnostics,
    priorities_90d: priorities90d,
    warning,
  }

  return {
    agent_code: "BPI-01",
    analysis_date: new Date().toISOString(),
    brand_profile: profile,
    payload,
    degraded_sources: degradedSources,
    version: "1.0",
  }
}
