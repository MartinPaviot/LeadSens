import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createSSEStream } from "@/lib/sse-brand-intel"
import { runCia03 } from "@/agents/cia-03/index"
import type { AgentProfile } from "@/agents/_shared/types"
import type { CiaOutput, CiaSessionContext } from "@/agents/cia-03/types"
import type { BpiOutput } from "@/agents/bpi-01/types"
import { safeAgentOutput } from "@/lib/type-guards"
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

  // Load last BPI-01 run for social_score cross-signal
  const lastBpiRun = await prisma.elevayAgentRun.findFirst({
    where: { workspaceId, agentCode: "BPI-01" },
    orderBy: { createdAt: "desc" },
  })

  const brandSocialScore = lastBpiRun
    ? (() => {
        const bpi = safeAgentOutput<BpiOutput>(lastBpiRun.output)
        return bpi?.payload?.scores?.social ?? undefined
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

  const priorityChannels =
    body.priority_channels ?? profileRow.priority_channels
  const objective =
    toValidObjective(body.objective ?? profileRow.objective ?? "") ?? "lead_gen"

  const context: CiaSessionContext = {
    priority_channels:
      priorityChannels.length > 0 ? priorityChannels : ["SEO"],
    objective,
  }

  const startedAt = Date.now()

  return createSSEStream(async (emit) => {
    emit("status", {
      message: "[0/6] Starting competitive analysis...",
      index: 0,
      total: 6,
    })

    const output = await runCia03(profile, context, brandSocialScore)

    const modules = [
      "product-messaging",
      "seo-acquisition",
      "social-media",
      "content",
      "benchmark",
      "recommendations",
    ]
    modules.forEach((mod, i) => {
      const degraded = output.degraded_sources.includes(mod)
      emit("status", {
        message: `[${i + 1}/6] ${mod} ${degraded ? "⚠" : "✓"}`,
        module: mod,
        index: i + 1,
        total: 6,
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
