import { prisma } from "@/lib/prisma"

// Claude Sonnet 4 pricing (USD per million tokens)
const PRICING = {
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-sonnet-4-5-20251022": { input: 3.0, output: 15.0 },
  default: { input: 3.0, output: 15.0 },
} as const

interface TrackAIEventParams {
  workspaceId: string
  agentCode: string
  model: string
  tokensIn: number
  tokensOut: number
  latencyMs: number
  action?: string
}

/**
 * Track an LLM API call for cost monitoring and analytics.
 * Non-blocking — never throws, never delays the caller.
 */
export async function trackAIEvent(
  params: TrackAIEventParams,
): Promise<void> {
  try {
    const pricing =
      PRICING[params.model as keyof typeof PRICING] ?? PRICING.default
    const cost =
      (params.tokensIn / 1_000_000) * pricing.input +
      (params.tokensOut / 1_000_000) * pricing.output

    await prisma.aIEvent.create({
      data: {
        workspaceId: params.workspaceId,
        provider: "anthropic",
        model: params.model,
        action: params.action ?? params.agentCode,
        tokensIn: params.tokensIn,
        tokensOut: params.tokensOut,
        cost: Math.round(cost * 1_000_000) / 1_000_000, // 6 decimal places
        latencyMs: params.latencyMs,
        metadata: { agentCode: params.agentCode },
      },
    })
  } catch {
    // Never block the agent for tracking failures
  }
}
