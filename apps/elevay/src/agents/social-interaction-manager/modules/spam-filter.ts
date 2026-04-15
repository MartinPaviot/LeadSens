import type { IncomingMessage } from "../core/types"
import { SPAM_PATTERNS } from "../core/constants"

/** Quick spam detection — no LLM needed. */
export function isSpam(message: IncomingMessage): boolean {
  const content = message.content.trim()

  // Empty or near-empty
  if (content.length < 4) return true

  // Pattern matching
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(content)) return true
  }

  return false
}
