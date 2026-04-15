import { callLLM } from "@/agents/_shared/llm"
import type { IncomingMessage, Classification, InteractionConfig } from "../core/types"
import { FAQCache } from "./faq-cache"
import { getResponsePrompt } from "../core/prompts"

interface ResponseLLMResult {
  response: string
  tone: string
  suggestedAction: string
}

function isResponseResult(v: unknown): v is ResponseLLMResult {
  if (!v || typeof v !== "object") return false
  return typeof (v as Record<string, unknown>)["response"] === "string"
}

/**
 * Generate a response for a classified message.
 * FAQ matches bypass LLM entirely.
 */
export async function generateResponse(
  message: IncomingMessage,
  classification: Classification,
  config: InteractionConfig,
  faqCache: FAQCache,
  language = "en",
): Promise<string | null> {
  // Spam: no response
  if (classification.category === "spam") return null

  // Toxic: no response (delete if configured)
  if (classification.category === "toxic") return null

  // FAQ match: use cached response (0 LLM calls)
  const faqMatch = faqCache.match(message.content)
  if (faqMatch) return faqMatch.answer

  // LLM-generated response
  const response = await callLLM({
    system: getResponsePrompt(language, config.brandTone),
    user: `Message from @${message.author.handle} on ${message.platform} (${message.type}):
"${message.content}"

Classification: ${classification.category} (sentiment: ${classification.sentiment}, score: ${classification.sentimentScore}/10)
${message.parentPostContent ? `Context: "${message.parentPostContent}"` : ""}

Generate an appropriate response.`,
    maxTokens: 512,
    temperature: 0.7,
  })

  if (isResponseResult(response.parsed)) {
    return response.parsed.response
  }

  return null
}
