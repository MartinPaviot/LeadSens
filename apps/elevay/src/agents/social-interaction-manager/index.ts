import type {
  IncomingMessage,
  InteractionConfig,
  ProcessingResult,
} from "./core/types"
import { classifyMessage } from "./modules/classifier"
import { generateResponse } from "./modules/responder"
import { checkEscalation } from "./modules/escalator"
import { qualifyLead } from "./modules/lead-qualifier"
import { FAQCache } from "./modules/faq-cache"

export { FAQCache } from "./modules/faq-cache"

/**
 * Main orchestrator: process a single incoming message.
 *
 * Flow: Classify → Route → Respond → Escalate? → Qualify Lead?
 */
export async function processMessage(
  message: IncomingMessage,
  config: InteractionConfig,
  faqCache: FAQCache,
  language = "en",
): Promise<ProcessingResult> {
  // 1. Classify
  const classification = await classifyMessage(message, faqCache, language)

  // 2. Generate response (if applicable)
  const response = await generateResponse(
    message,
    classification,
    config,
    faqCache,
    language,
  )

  // 3. Check escalation
  const escalation = checkEscalation(message, classification, config)

  // 4. Qualify lead (if classified as lead)
  const leadQualification =
    classification.category === "lead"
      ? await qualifyLead(message, classification, language)
      : undefined

  // 5. Determine if response should be sent automatically
  const shouldAutoSend =
    config.automationLevel === "full-auto" ||
    (config.automationLevel === "off-hours" && isOutsideWorkHours(config))

  return {
    message,
    classification,
    response: response ?? undefined,
    responseSent: shouldAutoSend && !!response,
    escalation: escalation ?? undefined,
    leadQualification,
    processedAt: new Date().toISOString(),
  }
}

function isOutsideWorkHours(config: InteractionConfig): boolean {
  if (!config.offHoursSchedule) return false
  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const currentTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
  const day = now.getDay()

  const { workStart, workEnd, workDays } = config.offHoursSchedule
  if (!workDays.includes(day)) return true
  return currentTime < workStart || currentTime > workEnd
}
