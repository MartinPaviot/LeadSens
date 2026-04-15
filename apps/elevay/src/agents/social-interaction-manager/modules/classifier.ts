import { callLLM } from "@/agents/_shared/llm"
import type {
  IncomingMessage,
  Classification,
  MessageCategory,
  SentimentLevel,
} from "../core/types"
import { FAQCache } from "./faq-cache"
import { isSpam } from "./spam-filter"
import { getClassificationPrompt } from "../core/prompts"
import { DEFAULT_ESCALATION_THRESHOLDS } from "../core/constants"

interface ClassificationLLMResponse {
  category: string
  confidence: number
  sentiment: string
  sentimentScore: number
}

const VALID_CATEGORIES: MessageCategory[] = [
  "lead", "negative", "toxic", "support", "product-question",
  "partnership", "influencer", "positive", "neutral", "spam",
]

const VALID_SENTIMENTS: SentimentLevel[] = [
  "positive", "neutral", "negative", "urgent",
]

function isClassificationResponse(v: unknown): v is ClassificationLLMResponse {
  if (!v || typeof v !== "object") return false
  const obj = v as Record<string, unknown>
  return typeof obj["category"] === "string" && typeof obj["sentimentScore"] === "number"
}

/**
 * Two-layer classification:
 * Layer 1: Rules (spam filter + FAQ match) — handles ~80% of messages
 * Layer 2: LLM (Claude) — handles ambiguous/complex messages
 */
export async function classifyMessage(
  message: IncomingMessage,
  faqCache: FAQCache,
  language = "en",
): Promise<Classification> {
  // Layer 1: Spam check
  if (isSpam(message)) {
    return {
      category: "spam",
      confidence: 0.95,
      sentiment: "neutral",
      sentimentScore: 5,
      isInfluencer: false,
      layer: 1,
    }
  }

  // Layer 1: FAQ match
  const faqMatch = faqCache.match(message.content)
  if (faqMatch) {
    faqCache.incrementHit(faqMatch.id)
    return {
      category: "product-question",
      confidence: 0.9,
      sentiment: "neutral",
      sentimentScore: 5,
      isInfluencer: false,
      layer: 1,
    }
  }

  // Layer 1: Influencer check (by follower count)
  const isInfluencer =
    (message.author.followers ?? 0) >= DEFAULT_ESCALATION_THRESHOLDS.influencerAudienceMin

  // Layer 2: LLM classification
  const response = await callLLM({
    system: getClassificationPrompt(language),
    user: `Platform: ${message.platform}\nType: ${message.type}\nAuthor: ${message.author.name} (@${message.author.handle}, ${message.author.followers ?? "unknown"} followers)\nMessage: ${message.content}${message.parentPostContent ? `\nContext (parent post): ${message.parentPostContent}` : ""}`,
    maxTokens: 256,
    temperature: 0.3,
  })

  if (isClassificationResponse(response.parsed)) {
    const category = VALID_CATEGORIES.includes(
      response.parsed.category as MessageCategory,
    )
      ? (response.parsed.category as MessageCategory)
      : "neutral"

    const sentiment = VALID_SENTIMENTS.includes(
      response.parsed.sentiment as SentimentLevel,
    )
      ? (response.parsed.sentiment as SentimentLevel)
      : "neutral"

    return {
      category: isInfluencer && category === "neutral" ? "influencer" : category,
      confidence: Math.min(1, Math.max(0, response.parsed.confidence)),
      sentiment,
      sentimentScore: Math.min(10, Math.max(0, response.parsed.sentimentScore)),
      isInfluencer,
      layer: 2,
    }
  }

  // Fallback
  return {
    category: "neutral",
    confidence: 0.3,
    sentiment: "neutral",
    sentimentScore: 5,
    isInfluencer,
    layer: 2,
  }
}
