import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createSSEStream } from "@/lib/sse-brand-intel"
import { runBpi01 } from "@/agents/bpi-01/index"
import type { AgentProfile } from "@/agents/_shared/types"
import type { BpiOutput, BpiScores } from "@/agents/bpi-01/types"
import { safeAgentOutput } from "@/lib/type-guards"
import { Prisma } from "@prisma/client"

export const maxDuration = 300
export const dynamic = "force-dynamic"

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.workspaceId) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }
  const workspaceId = session.user.workspaceId

  const profileRow = await prisma.elevayBrandProfile.findUnique({
    where: { workspaceId },
  })
  if (!profileRow) {
    return Response.json(
      { error: "NO_PROFILE", message: "Configure your brand profile first" },
      { status: 400 },
    )
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

  const competitors = profileRow.competitors as unknown as Array<{
    name: string
    url: string
  }>
  const profile: AgentProfile = {
    workspaceId: profileRow.workspaceId,
    brand_name: profileRow.brand_name,
    brand_url: profileRow.brand_url,
    country: profileRow.country,
    language: profileRow.language,
    competitors,
    primary_keyword: profileRow.primary_keyword,
    secondary_keyword: profileRow.secondary_keyword,
    sector: profileRow.sector ?? undefined,
    priority_channels: profileRow.priority_channels,
    objective: profileRow.objective ?? undefined,
    facebookConnected: profileRow.facebookConnected,
    facebookComposioAccountId:
      profileRow.facebookComposioAccountId ?? undefined,
    instagramConnected: profileRow.instagramConnected,
    instagramComposioAccountId:
      profileRow.instagramComposioAccountId ?? undefined,
  }

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
        brandProfileId: profileRow.id,
      },
    })

    emit("result", { output: output.payload })
    emit("finish", {
      durationMs: Date.now() - startedAt,
      degraded_sources: output.degraded_sources,
    })
  })
}
