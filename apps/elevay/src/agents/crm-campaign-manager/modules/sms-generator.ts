import { callLLM } from "@/agents/_shared/llm"
import type { SMSDraft, CampaignTone, CampaignObjective } from "../core/types"
import { getSMSSystemPrompt } from "../core/prompts"
import { SMS_CHAR_LIMIT } from "../core/constants"

interface SMSLLMResponse {
  message: string
  variantB?: { message: string }
}

function isSMSResponse(v: unknown): v is SMSLLMResponse {
  if (!v || typeof v !== "object") return false
  const obj = v as Record<string, unknown>
  return typeof obj["message"] === "string"
}

export async function generateSMSDraft(params: {
  tone: CampaignTone
  objective: CampaignObjective
  offerUrl?: string
  promoCode?: string
  abEnabled?: boolean
  language?: string
}): Promise<SMSDraft> {
  const language = params.language ?? "en"

  const response = await callLLM({
    system: getSMSSystemPrompt(params.tone, params.objective, language),
    user: `Objective: ${params.objective}\n${params.promoCode ? `Promo code: ${params.promoCode}` : ""}`,
    maxTokens: 512,
    temperature: 0.7,
  })

  const trackedLink = params.offerUrl ?? "https://link.example.com/track"

  if (isSMSResponse(response.parsed)) {
    const message = response.parsed.message.replace(
      /\{\{LINK\}\}/g,
      trackedLink,
    )
    return {
      message: message.slice(0, SMS_CHAR_LIMIT),
      characterCount: Math.min(message.length, SMS_CHAR_LIMIT),
      trackedLink,
      variantB: response.parsed.variantB
        ? {
            message: response.parsed.variantB.message
              .replace(/\{\{LINK\}\}/g, trackedLink)
              .slice(0, SMS_CHAR_LIMIT),
          }
        : undefined,
    }
  }

  return {
    message: `Check out our latest offer: ${trackedLink}`.slice(
      0,
      SMS_CHAR_LIMIT,
    ),
    characterCount: SMS_CHAR_LIMIT,
    trackedLink,
  }
}
