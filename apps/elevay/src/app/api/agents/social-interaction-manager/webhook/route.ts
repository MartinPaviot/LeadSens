import { prisma } from "@/lib/prisma"
import { processMessage, FAQCache } from "@/agents/social-interaction-manager/index"
import { normalizeMessage } from "@/agents/social-interaction-manager/modules/receiver"
import type { InteractionConfig, SMIPlatform } from "@/agents/social-interaction-manager/core/types"
import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Webhook endpoint for incoming social media messages.
 * Called by Composio when a new DM/comment/mention arrives.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 })
  }

  const platform = body["platform"] as SMIPlatform | undefined
  const workspaceId = body["workspaceId"] as string | undefined

  if (!platform || !workspaceId) {
    return NextResponse.json(
      { error: "Missing platform or workspaceId" },
      { status: 400 },
    )
  }

  // Load config from workspace
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { settings: true },
  })

  const settings = (workspace?.settings as Record<string, unknown> | null) ?? {}
  const config = settings.interactionConfig as InteractionConfig | undefined

  if (!config) {
    return NextResponse.json(
      { error: "Agent not configured for this workspace" },
      { status: 400 },
    )
  }

  // Normalize the incoming message
  const message = normalizeMessage(platform, body)

  // Load FAQ cache
  const faqCache = new FAQCache()
  // TODO: Load FAQs from DB

  // Process the message
  const result = await processMessage(message, config, faqCache)

  // Persist the run
  await prisma.elevayAgentRun.create({
    data: {
      workspaceId,
      agentCode: "SMI-20",
      status: result.escalation ? "PARTIAL" : "COMPLETED",
      output: result as unknown as Prisma.InputJsonValue,
      degradedSources: [],
      durationMs: 0,
    },
  })

  return NextResponse.json({
    processed: true,
    category: result.classification.category,
    responseSent: result.responseSent,
    escalated: !!result.escalation,
  })
}
