import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { runCRM } from "@/agents/crm-campaign-manager/index"
import { CRMCampaignBriefSchema } from "@/agents/crm-campaign-manager/modules/brief-parser"
import { loadWorkspaceContext, NoConfigError, noConfigResponse } from "@/lib/agent-context"
import { toCRMConfig } from "@/lib/agent-adapters"
import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { checkLLMRateLimit, rateLimitResponse } from "@/lib/rate-limit"

export const maxDuration = 300
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let workspaceId = (session.user as Record<string, unknown>).workspaceId as
    | string
    | undefined
  if (!workspaceId) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { workspaceId: true },
    })
    workspaceId = user?.workspaceId ?? undefined
  }
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 })
  }

  const rateCheck = await checkLLMRateLimit(session.user.id, workspaceId)
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck.retryAfter)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 })
  }

  const parsed = CRMCampaignBriefSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  // Load CRM config — Settings priority, platform override from brief
  let crmConfig
  try {
    const ctx = await loadWorkspaceContext(workspaceId)
    const adapter = toCRMConfig(ctx)
    // Brief's platform wins: user is explicitly targeting one in this run
    crmConfig = { ...adapter.data, platform: parsed.data.platform }
  } catch (err) {
    if (err instanceof NoConfigError) return noConfigResponse(err)
    throw err
  }

  const brief = parsed.data

  // SSE streaming
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
          ),
        )
      }

      try {
        send("status", { step: "starting", message: "Analyzing brief..." })
        send("status", { step: "timing", message: "Calculating optimal timing..." })

        const result = await runCRM(brief, crmConfig)

        // Persist run
        await prisma.elevayAgentRun.create({
          data: {
            workspaceId,
            agentCode: "CRM-27",
            status: "COMPLETED",
            output: {
              emailDraft: result.emailDraft ?? null,
              smsDraft: result.smsDraft ?? null,
              timingProposals: result.timingProposals,
              brief: parsed.data,
            } as unknown as Prisma.InputJsonValue,
            degradedSources: [],
            durationMs: result.durationMs,
          },
        })

        send("complete", {
          emailDraft: result.emailDraft,
          smsDraft: result.smsDraft,
          timingProposals: result.timingProposals,
          durationMs: result.durationMs,
        })
      } catch (error) {
        send("error", {
          message:
            error instanceof Error ? error.message : "Unknown error",
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
