import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createSSEStream } from "@/lib/sse-brand-intel"
import { runMts02 } from "@/agents/mts-02/index"
import { safeAgentOutput } from "@/lib/type-guards"
import { checkLLMRateLimit, rateLimitResponse } from "@/lib/rate-limit"
import type {
  MtsOutput,
  MtsSessionContext,
  MtsPreviousComparison,
} from "@/agents/mts-02/types"
import { loadWorkspaceContext, NoConfigError, noConfigResponse, requireFields } from "@/lib/agent-context"
import { toAgentProfile } from "@/lib/agent-adapters"
import { Prisma } from "@prisma/client"
import { z } from "zod"

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

  const rateCheck = await checkLLMRateLimit(session.user.id, workspaceId)
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck.retryAfter)
  }

  const MtsBodySchema = z.object({
    priority_channels: z.array(z.string()).optional(),
    sector: z.string().optional(),
  }).optional()

  let body: { priority_channels?: string[]; sector?: string } = {}
  try {
    const raw = await req.json()
    const parsed = MtsBodySchema.safeParse(raw)
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
    where: { workspaceId, agentCode: "MTS-02" },
    orderBy: { createdAt: "desc" },
  })

  const previousComparison: MtsPreviousComparison | undefined = previousRun
    ? (() => {
        const prev = safeAgentOutput<MtsOutput>(previousRun.output)
        if (!prev) return undefined
        return {
          date: previousRun.createdAt.toISOString(),
          global_score: prev.payload?.global_score ?? 0,
          trending_topics:
            prev.payload?.trending_topics?.map((t) => t.topic) ?? [],
          saturated_topics:
            prev.payload?.saturated_topics?.map((t) => t.topic) ?? [],
        }
      })()
    : undefined

  const rawChannels = body.priority_channels ?? profile.priority_channels ?? []
  const priorityChannels = rawChannels
    .map(toValidChannel)
    .filter((c): c is ValidChannel => c !== null)

  const context: MtsSessionContext = {
    sector: body.sector ?? profile.sector ?? profile.primary_keyword,
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
      },
    })

    emit("result", { output: output.payload })
    emit("finish", {
      durationMs: Date.now() - startedAt,
      degraded_sources: output.degraded_sources,
    })
  })
}
