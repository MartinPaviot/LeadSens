import { createHmac, timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import { processMessage, FAQCache } from "@/agents/social-interaction-manager/index"
import { normalizeMessage } from "@/agents/social-interaction-manager/modules/receiver"
import type { SMIPlatform } from "@/agents/social-interaction-manager/core/types"
import { loadWorkspaceContext } from "@/lib/agent-context"
import { toInteractionConfig } from "@/lib/agent-adapters"
import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// ── HMAC Signature Verification ─────────────────────────

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.SMI_WEBHOOK_SECRET
  if (!secret) return false
  if (!signature) return false

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")

  // Ensure equal length before timing-safe comparison
  if (expected.length !== signature.length) return false

  return timingSafeEqual(
    Buffer.from(expected, "utf-8"),
    Buffer.from(signature, "utf-8"),
  )
}

/**
 * Webhook endpoint for incoming social media messages.
 * Called by Composio when a new DM/comment/mention arrives.
 * Protected by HMAC-SHA256 signature verification.
 */
export async function POST(req: Request) {
  // Read raw body BEFORE parsing (stream consumed once)
  const rawBody = await req.text()

  // Verify HMAC signature
  const signature = req.headers.get("x-webhook-signature")
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>
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

  let config
  try {
    const ctx = await loadWorkspaceContext(workspaceId)
    const adapter = toInteractionConfig(ctx)
    if (adapter.missing.length > 0) {
      return NextResponse.json(
        { error: "NO_CONFIG", missing: adapter.missing, tab: "Automation & Escalation" },
        { status: 400 },
      )
    }
    config = adapter.data
    // Platform in the event overrides Settings priorityChannels if the event's platform
    // isn't in the configured list — otherwise we'd drop legitimate events.
    if (!config.platforms.includes(platform)) {
      config = { ...config, platforms: [...config.platforms, platform] }
    }
  } catch {
    return NextResponse.json({ error: "NO_WORKSPACE" }, { status: 400 })
  }

  const message = normalizeMessage(platform, body)

  const faqCache = new FAQCache()

  const result = await processMessage(message, config, faqCache)

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
