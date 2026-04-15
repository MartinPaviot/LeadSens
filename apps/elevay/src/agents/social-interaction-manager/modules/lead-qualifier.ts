import { callLLM } from "@/agents/_shared/llm"
import type {
  IncomingMessage,
  Classification,
  LeadQualification,
} from "../core/types"
import { getLeadQualificationPrompt } from "../core/prompts"

interface LeadLLMResponse {
  score: number
  budget?: string
  need?: string
  timeline?: string
  isDecisionMaker?: boolean
}

function isLeadResponse(v: unknown): v is LeadLLMResponse {
  if (!v || typeof v !== "object") return false
  return typeof (v as Record<string, unknown>)["score"] === "number"
}

/**
 * Qualify a lead from a social message.
 * Only called when classification.category === 'lead'.
 */
export async function qualifyLead(
  message: IncomingMessage,
  classification: Classification,
  language = "en",
): Promise<LeadQualification> {
  if (classification.category !== "lead") {
    return {
      messageId: message.id,
      score: 0,
      crmSyncStatus: "pending",
    }
  }

  const response = await callLLM({
    system: getLeadQualificationPrompt(language),
    user: `Message from @${message.author.handle} (${message.author.followers ?? "?"} followers) on ${message.platform}:\n"${message.content}"`,
    maxTokens: 256,
    temperature: 0.3,
  })

  if (isLeadResponse(response.parsed)) {
    return {
      messageId: message.id,
      score: Math.min(100, Math.max(0, response.parsed.score)),
      budget: response.parsed.budget,
      need: response.parsed.need,
      timeline: response.parsed.timeline,
      isDecisionMaker: response.parsed.isDecisionMaker,
      crmSyncStatus: "pending",
    }
  }

  return {
    messageId: message.id,
    score: 30, // Default low score
    crmSyncStatus: "pending",
  }
}
