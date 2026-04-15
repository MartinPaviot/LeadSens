import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { runBDG } from "@/agents/budget-controller/index"
import type { BudgetConfig } from "@/agents/budget-controller/core/types"
import { collectChannelMetrics } from "@/agents/budget-controller/modules/data-collector"
import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

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

  // Load config from workspace settings
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { settings: true },
  })

  const settings =
    (workspace?.settings as Record<string, unknown> | null) ?? {}
  const budgetConfig = settings.budgetConfig as BudgetConfig | undefined

  if (!budgetConfig) {
    return NextResponse.json(
      {
        error: "NO_CONFIG",
        message: "Configure your budget first via onboarding",
      },
      { status: 400 },
    )
  }

  const period = `week-${new Date().toISOString().slice(0, 10)}`
  const channelMetrics = await collectChannelMetrics(budgetConfig, period)

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
        send("status", {
          step: "collecting",
          message: "Syncing channel data...",
        })
        send("status", {
          step: "scoring",
          message: "Calculating health score...",
        })

        const result = await runBDG(budgetConfig, channelMetrics)

        await prisma.elevayAgentRun.create({
          data: {
            workspaceId,
            agentCode: "BDG-32",
            status: "COMPLETED",
            output: result.dashboard as unknown as Prisma.InputJsonValue,
            degradedSources: [],
            durationMs: result.durationMs,
          },
        })

        send("complete", { dashboard: result.dashboard })
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
