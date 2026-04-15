import type {
  IncomingMessage,
  Classification,
  InteractionConfig,
  Escalation,
  EscalationLevel,
} from "../core/types"

/**
 * Determine if a message needs escalation based on classification and config.
 */
export function checkEscalation(
  message: IncomingMessage,
  classification: Classification,
  config: InteractionConfig,
): Escalation | null {
  let level: EscalationLevel | null = null
  let actionTaken = ""

  // Critical: toxic content or very negative sentiment
  if (classification.category === "toxic") {
    level = "critical"
    actionTaken = "Toxic content detected — flagged for review"
  } else if (classification.sentimentScore <= config.escalationThresholds.sentimentMin) {
    level = "critical"
    actionTaken = `Low sentiment score (${classification.sentimentScore}/10) — escalated`
  }

  // Attention: negative with moderate sentiment
  if (!level && classification.category === "negative") {
    level = "attention"
    actionTaken = "Negative feedback detected — queued for review"
  }

  // Opportunity: influencer or high-value lead
  if (!level && classification.isInfluencer) {
    level = "opportunity"
    actionTaken = `Influencer detected (${message.author.followers?.toLocaleString() ?? "?"} followers)`
  }

  if (!level && classification.category === "lead" && classification.confidence > 0.8) {
    level = "opportunity"
    actionTaken = "High-confidence lead detected"
  }

  if (!level) return null

  return {
    level,
    message,
    classification,
    actionTaken,
    notifiedVia: config.escalationChannel,
    timestamp: new Date().toISOString(),
  }
}
