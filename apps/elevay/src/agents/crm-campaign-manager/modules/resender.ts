import { callLLM } from "@/agents/_shared/llm"
import type { ResendConfig, ResendProposal } from "../core/types"

/**
 * Generate a resend proposal for non-openers.
 */
export async function generateResendProposal(params: {
  originalSubject: string
  nonOpenerCount: number
  config: ResendConfig
  language?: string
}): Promise<ResendProposal | null> {
  if (!params.config.enabled) return null
  if (params.nonOpenerCount === 0) return null

  const response = await callLLM({
    system: `You are an email subject line expert. Generate a NEW subject line that is significantly different from the original. It should create curiosity without being spammy. Respond in ${params.language ?? "en"}. Return ONLY a JSON: { "newSubject": "..." }`,
    user: `Original subject: "${params.originalSubject}"\nNon-openers: ${params.nonOpenerCount} contacts\n\nGenerate a compelling alternative subject line.`,
    maxTokens: 256,
    temperature: 0.8,
  })

  let newSubject = `RE: ${params.originalSubject}`
  if (
    response.parsed &&
    typeof response.parsed === "object" &&
    typeof (response.parsed as Record<string, unknown>)["newSubject"] ===
      "string"
  ) {
    newSubject = (response.parsed as Record<string, string>)["newSubject"]
  }

  return {
    segment: params.config.segment,
    count: params.nonOpenerCount,
    newSubject,
  }
}
