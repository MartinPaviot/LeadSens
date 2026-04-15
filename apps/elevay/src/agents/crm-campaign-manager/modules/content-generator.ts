import { callLLM } from "@/agents/_shared/llm"
import type {
  EmailDraft,
  CampaignTone,
  CampaignObjective,
  ABConfig,
} from "../core/types"
import { getEmailSystemPrompt, getEmailABPrompt } from "../core/prompts"

interface EmailLLMResponse {
  subject: string
  preHeader: string
  bodyHtml: string
  cta: { text: string; url: string }
}

function isEmailResponse(v: unknown): v is EmailLLMResponse {
  if (!v || typeof v !== "object") return false
  const obj = v as Record<string, unknown>
  return (
    typeof obj["subject"] === "string" &&
    typeof obj["bodyHtml"] === "string" &&
    typeof obj["cta"] === "object"
  )
}

export async function generateEmailDraft(params: {
  tone: CampaignTone
  objective: CampaignObjective
  segment: string
  offerUrl?: string
  promoCode?: string
  abConfig?: ABConfig
  language?: string
}): Promise<EmailDraft> {
  const language = params.language ?? "en"

  const systemPrompt = getEmailSystemPrompt(
    params.tone,
    params.objective,
    params.segment,
    language,
  )

  const userPrompt = buildEmailUserPrompt(params)

  const response = await callLLM({
    system: systemPrompt,
    user: userPrompt,
    maxTokens: 2048,
    temperature: 0.7,
  })

  const draft: EmailDraft = {
    subject: "Campaign email",
    preHeader: "",
    bodyHtml: "<p>Draft generation in progress</p>",
    cta: { text: "Learn more", url: params.offerUrl ?? "#" },
  }

  if (isEmailResponse(response.parsed)) {
    draft.subject = response.parsed.subject
    draft.preHeader = response.parsed.preHeader
    draft.bodyHtml = response.parsed.bodyHtml.replace(
      /\{\{OFFER_URL\}\}/g,
      params.offerUrl ?? "#",
    )
    draft.cta = {
      text: response.parsed.cta.text,
      url: params.offerUrl ?? response.parsed.cta.url,
    }
  }

  // Generate variant B if A/B enabled
  if (params.abConfig?.enabled) {
    const abPrompt = getEmailABPrompt(
      params.tone,
      params.objective,
      params.abConfig.variable,
      language,
    )

    const abResponse = await callLLM({
      system: abPrompt,
      user: `Original email:\nSubject: ${draft.subject}\nCTA: ${draft.cta.text}\n\nGenerate a meaningfully different variant B.`,
      maxTokens: 1024,
      temperature: 0.8,
    })

    if (abResponse.parsed && typeof abResponse.parsed === "object") {
      const variant = abResponse.parsed as Record<string, unknown>
      draft.variantB = {}
      if (typeof variant["subject"] === "string") {
        draft.variantB.subject = variant["subject"]
      }
      if (variant["cta"] && typeof variant["cta"] === "object") {
        const ctaObj = variant["cta"] as Record<string, string>
        draft.variantB.cta = {
          text: ctaObj["text"] ?? draft.cta.text,
          url: params.offerUrl ?? ctaObj["url"] ?? "#",
        }
      }
      if (typeof variant["bodyHtml"] === "string") {
        draft.variantB.bodyHtml = variant["bodyHtml"]
      }
    }
  }

  return draft
}

function buildEmailUserPrompt(params: {
  tone: CampaignTone
  objective: CampaignObjective
  segment: string
  offerUrl?: string
  promoCode?: string
}): string {
  const lines = [
    `Campaign objective: ${params.objective}`,
    `Target segment: ${params.segment}`,
    `Tone: ${params.tone}`,
  ]
  if (params.offerUrl) lines.push(`Offer URL: ${params.offerUrl}`)
  if (params.promoCode) lines.push(`Promo code: ${params.promoCode}`)
  return lines.join("\n")
}
