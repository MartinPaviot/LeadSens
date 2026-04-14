import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createSSEStream } from "@/lib/sse-brand-intel"
import { runMts02 } from "@/agents/mts-02/index"
import type { AgentProfile, AgentOutput } from "@/agents/_shared/types"
import type {
  MtsOutput,
  MtsSessionContext,
  MtsPreviousComparison,
} from "@/agents/mts-02/types"
import { Prisma } from "@prisma/client"

export const maxDuration = 300
export const dynamic = "force-dynamic"

const VALID_CHANNELS = [
  "SEO",
  "LinkedIn",
  "YouTube",
  "TikTok",
  "Instagram",
  "Facebook",
  "X",
  "Press",
] as const
type ValidChannel = (typeof VALID_CHANNELS)[number]

function toValidChannel(s: string): ValidChannel | null {
  return (VALID_CHANNELS as readonly string[]).includes(s)
    ? (s as ValidChannel)
    : null
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.workspaceId) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }
  const workspaceId = session.user.workspaceId

  let body: { priority_channels?: string[]; sector?: string } = {}
  try {
    body = (await req.json()) as typeof body
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
    where: { workspaceId, agentCode: "MTS-02" },
    orderBy: { createdAt: "desc" },
  })

  const previousComparison: MtsPreviousComparison | undefined = previousRun
    ? (() => {
        const prev = previousRun.output as unknown as AgentOutput<MtsOutput>
        return {
          date: previousRun.createdAt.toISOString(),
          global_score: prev.payload?.global_score ?? 0,
          trending_topics:
            prev.payload?.trending_topics.map((t) => t.topic) ?? [],
          saturated_topics:
            prev.payload?.saturated_topics.map((t) => t.topic) ?? [],
        }
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

  const rawChannels = body.priority_channels ?? profileRow.priority_channels
  const priorityChannels = rawChannels
    .map(toValidChannel)
    .filter((c): c is ValidChannel => c !== null)

  const context: MtsSessionContext = {
    sector: body.sector ?? profileRow.sector ?? profile.primary_keyword,
    priority_channels:
      priorityChannels.length > 0 ? priorityChannels : ["SEO"],
  }

  const startedAt = Date.now()

  return createSSEStream(async (emit) => {
    emit("status", {
      message: "[0/5] Starting trend analysis...",
      index: 0,
      total: 5,
    })

    const output = await runMts02(profile, context)

    emit("status", {
      message: `[2/5] Trends ${output.degraded_sources.includes("trends") ? "⚠" : "✓"}`,
      module: "trends",
      index: 2,
      total: 5,
    })
    emit("status", {
      message: `[3/5] Content ${output.degraded_sources.includes("content") ? "⚠" : "✓"}`,
      module: "content",
      index: 3,
      total: 5,
    })
    emit("status", {
      message: "[4/5] Synthesis ✓",
      module: "synthesis",
      index: 4,
      total: 5,
    })
    emit("status", {
      message: "[5/5] LLM analysis ✓",
      module: "llm",
      index: 5,
      total: 5,
    })

    if (previousComparison) {
      output.payload.previous = previousComparison
    }

    const status =
      output.degraded_sources.length > 0 ? "PARTIAL" : "COMPLETED"
    await prisma.elevayAgentRun.create({
      data: {
        workspaceId,
        agentCode: "MTS-02",
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
