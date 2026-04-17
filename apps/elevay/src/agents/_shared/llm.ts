import Anthropic from "@anthropic-ai/sdk"
import { env } from "@/lib/env"
import { trackAIEvent } from "@/lib/ai-tracker"
import type { LLMRequest, LLMResponse } from "./types"
import { agentWarn, agentError } from "./agent-logger"

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

/**
 * Robust JSON parser — strips fences, finds outermost {}, cleans trailing commas.
 */
function parseRobust(raw: string): unknown {
  let s = raw.trim()
  // Strip markdown fences
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "")
  // Find outermost JSON object
  const start = s.indexOf("{")
  const end = s.lastIndexOf("}")
  if (start === -1 || end === -1) {
    // Try array
    const aStart = s.indexOf("[")
    const aEnd = s.lastIndexOf("]")
    if (aStart === -1 || aEnd === -1) return null
    s = s.slice(aStart, aEnd + 1)
  } else {
    s = s.slice(start, end + 1)
  }
  // Clean trailing commas
  s = s.replace(/,\s*([\]}])/g, "$1")
  return JSON.parse(s)
}

export async function callLLM(
  req: LLMRequest,
  trackingContext?: { workspaceId: string; agentCode: string },
): Promise<LLMResponse> {
  const start = Date.now()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)

  try {
    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-6",
        max_tokens: req.maxTokens ?? 4096,
        temperature: req.temperature ?? 0.3,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
      },
      { signal: controller.signal },
    )

    const firstBlock = response.content[0]
    const content = firstBlock?.type === "text" ? firstBlock.text : ""

    let parsed: unknown = null
    try {
      parsed = parseRobust(content)
    } catch (parseErr) {
      agentWarn(
        trackingContext?.agentCode ?? "unknown",
        "llm",
        "JSON parse failed — LLM returned non-parseable content",
        { error: String(parseErr), contentPreview: content.slice(0, 200) },
      )
    }

    const result: LLMResponse = {
      content,
      parsed,
      tokens: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
      latencyMs: Date.now() - start,
      model: response.model,
    }

    // Track cost (fire-and-forget, never blocks)
    if (trackingContext) {
      void trackAIEvent({
        workspaceId: trackingContext.workspaceId,
        agentCode: trackingContext.agentCode,
        model: response.model,
        tokensIn: response.usage.input_tokens,
        tokensOut: response.usage.output_tokens,
        latencyMs: result.latencyMs,
      })
    }

    return result
  } catch (err) {
    agentError(
      trackingContext?.agentCode ?? "unknown",
      "llm",
      "LLM call failed",
      { error: err instanceof Error ? err.message : String(err) },
    )
    return {
      content: "",
      parsed: null,
      tokens: { input: 0, output: 0 },
      latencyMs: Date.now() - start,
      model: "error",
    }
  } finally {
    clearTimeout(timeout)
  }
}
