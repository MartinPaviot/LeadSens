import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createSSEStream } from "@/lib/sse-brand-intel"
import { runBpi01 } from "@/agents/bpi-01/index"
import type { BpiOutput, BpiScores } from "@/agents/bpi-01/types"
import { safeAgentOutput } from "@/lib/type-guards"
import { checkLLMRateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { loadWorkspaceContext, NoConfigError, noConfigResponse, requireFields } from "@/lib/agent-context"
import { toAgentProfile } from "@/lib/agent-adapters"
import { Prisma } from "@prisma/client"

export const maxDuration = 300
export const dynamic = "force-dynamic"

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.workspaceId) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }
  const workspaceId = session.user.workspaceId

  const rateCheck = await checkLLMRateLimit(session.user.id, workspaceId)
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck.retryAfter)
  }

  let profile
  try {
    const ctx = await loadWorkspaceContext(workspaceId)
    profile = requireFields(toAgentProfile(ctx), "Company + Brand Voice + Competitive Intelligence")
  } catch (err) {
    if (err instanceof NoConfigError) return noConfigResponse(err)
    throw err
  }

  const previousRun = await prisma.elevayAgentRun.findFirst({
    where: { workspaceId, agentCode: "BPI-01" },
    orderBy: { createdAt: "desc" },
  })

  const previousScores = previousRun
    ? (() => {
        const prev = safeAgentOutput<BpiOutput>(previousRun.output)
        return prev?.payload?.scores
      })()
    : undefined


  const startedAt = Date.now()

  return createSSEStream(async (emit) => {
    emit("status", {
      message: "[0/8] Starting audit...",
      index: 0,
      total: 8,
    })

    const output = await runBpi01(profile)

    if (previousScores) {
      const prev = previousScores as BpiScores
      output.payload.scores.previous = {
        global: prev.global,
        serp: prev.serp,
        press: prev.press,
        youtube: prev.youtube,
        social: prev.social,
        seo: prev.seo,
        benchmark: prev.benchmark,
        date:
          previousRun?.createdAt.toISOString() ?? new Date().toISOString(),
      }
    }

    const modules = [
      "serp",
      "press",
      "youtube",
      "social",
      "seo",
      "benchmark",
      "google-maps",
      "trustpilot",
    ]
    modules.forEach((mod, i) => {
      const degraded = output.degraded_sources.includes(mod)
      emit("status", {
        message: `[${i + 1}/8] ${mod} ${degraded ? "⚠" : "✓"}`,
        module: mod,
        index: i + 1,
        total: 8,
      })
    })

    const status =
      output.degraded_sources.length > 0 ? "PARTIAL" : "COMPLETED"
    await prisma.elevayAgentRun.create({
      data: {
        workspaceId,
        agentCode: "BPI-01",
        status,
        output: output as unknown as Prisma.InputJsonValue,
        degradedSources: output.degraded_sources,
        durationMs: Date.now() - startedAt,
      },
    })

    emit("result", { output: output.payload })
    emit("finish", {
      durationMs: Date.now() - startedAt,
      degraded_sources: output.degraded_sources,
    })
  })
}
