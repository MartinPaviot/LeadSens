/**
 * Sanitize user-controlled strings before interpolating into LLM prompts.
 * Defends against prompt injection by:
 * - Limiting length
 * - Stripping LLM control tokens (ChatML, Llama, etc.)
 * - Neutralizing role injection attempts
 * - Removing control characters
 */
export function sanitize(input: string, maxLength = 500): string {
  if (typeof input !== "string") return ""

  return (
    input
      // Limit length
      .slice(0, maxLength)
      // Block common LLM control tokens
      .replace(
        /<\|im_start\|>|<\|im_end\|>|<\|system\|>|<\|user\|>|<\|assistant\|>/gi,
        "",
      )
      .replace(/\[INST\]|\[\/INST\]|<<SYS>>|<<\/SYS>>/gi, "")
      // Neutralize role injection attempts
      .replace(/\bsystem\s*:/gi, "input:")
      .replace(/\bassistant\s*:/gi, "")
      .replace(/\bhuman\s*:/gi, "input:")
      // Strip backticks (could break JSON fences in prompts)
      .replace(/`/g, "'")
      // Remove control characters (keep newlines for readability)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      // Normalize excessive whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  )
}

const LANGUAGE_MAP: Record<string, string> = {
  fr: "français",
  en: "english",
  es: "español",
  de: "deutsch",
}

/** Convert ISO language code to human-readable name for LLM prompts. */
export function formatLanguage(lang: string): string {
  return LANGUAGE_MAP[lang] ?? lang
}
