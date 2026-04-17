import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createSSEStream } from "@/lib/sse-brand-intel"
import { runCia03 } from "@/agents/cia-03/index"
import type { CiaOutput, CiaSessionContext } from "@/agents/cia-03/types"
import type { BpiOutput } from "@/agents/bpi-01/types"
import { safeAgentOutput } from "@/lib/type-guards"
import { checkLLMRateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { loadWorkspaceContext, NoConfigError, noConfigResponse, requireFields } from "@/lib/agent-context"
import { toAgentProfile } from "@/lib/agent-adapters"
import { Prisma } from "@prisma/client"
import { z } from "zod"

export const maxDuration = 300
export const dynamic = "force-dynamic"

const VALID_OBJECTIVES = [
  "lead_gen",
  "acquisition",
  "retention",
  "branding",
] as const
type ValidObjective = (typeof VALID_OBJECTIVES)[number]

function toValidObjective(s: string): ValidObjective | null {
  return (VALID_OBJECTIVES as readonly string[]).includes(s)
    ? (s as ValidObjective)
    : null
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.workspaceId) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }
  const workspaceId = session.user.workspaceId

  const rateCheck = await checkLLMRateLimit(session.user.id, workspaceId)
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck.retryAfter)
  }

  const CiaBodySchema = z.object({
    priority_channels: z.array(z.string()).optional(),
    objective: z.string().optional(),
  }).optional()

  let body: { priority_channels?: string[]; objective?: string } = {}
  try {
    const raw = await req.json()
    const parsed = CiaBodySchema.safeParse(raw)
    if (parsed.success && parsed.data) body = parsed.data
  } catch {
    // empty body is fine
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
    where: { workspaceId, agentCode: "CIA-03" },
    orderBy: { createdAt: "desc" },
  })

  const previousData = previousRun
    ? (() => {
        const prev = safeAgentOutput<CiaOutput>(previousRun.output)
        if (!prev) return undefined
        return {
          date: previousRun.createdAt.toISOString(),
          brand_score: prev.payload?.brand_score ?? 0,
          competitor_scores:
            prev.payload?.competitor_scores?.map((c) => ({
              entity: c.entity,
              global_score: c.global_score,
            })) ?? [],
        }
      })()
    : undefined

  // Load last BPI-01 run for cross-signal data (social, Google Maps, Trustpilot)
  const lastBpiRun = await prisma.elevayAgentRun.findFirst({
    where: { workspaceId, agentCode: "BPI-01" },
    orderBy: { createdAt: "desc" },
  })

  let brandSocialScore: number | undefined
  let brandReviews: import("@/agents/cia-03/types").BpiCrossData | undefined

  if (lastBpiRun) {
    const bpi = safeAgentOutput<BpiOutput>(lastBpiRun.output)
    if (bpi?.payload) {
      brandSocialScore = bpi.payload.scores?.social
      brandReviews = {
        social_score: bpi.payload.scores?.social,
        google_maps: bpi.payload.googleMapsReputation ?? undefined,
        trustpilot: bpi.payload.trustpilot ?? undefined,
      }
    }
  }

  const priorityChannels =
    body.priority_channels ?? profile.priority_channels ?? []
  const objective =
    toValidObjective(body.objective ?? profile.objective ?? "") ?? "lead_gen"

  const context: CiaSessionContext = {
    priority_channels:
      priorityChannels.length > 0 ? priorityChannels : ["SEO"],
    objective,
  }

  const startedAt = Date.now()

  return createSSEStream(async (emit) => {
    emit("status", {
      message: "[0/7] Starting competitive analysis...",
      index: 0,
      total: 7,
    })

    const output = await runCia03(profile, context, brandSocialScore, brandReviews)

    const modules = [
      "product-messaging",
      "seo-acquisition",
      "social-media",
      "content",
      "competitor-reviews",
      "benchmark",
      "recommendations",
    ]
    modules.forEach((mod, i) => {
      const degraded = output.degraded_sources.includes(mod)
      emit("status", {
        message: `[${i + 1}/7] ${mod} ${degraded ? "⚠" : "✓"}`,
        module: mod,
        index: i + 1,
        total: 7,
      })
    })

    if (previousData) {
      output.payload.previous = previousData
    }

    const status =
      output.degraded_sources.length > 0 ? "PARTIAL" : "COMPLETED"
    await prisma.elevayAgentRun.create({
      data: {
        workspaceId,
        agentCode: "CIA-03",
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
