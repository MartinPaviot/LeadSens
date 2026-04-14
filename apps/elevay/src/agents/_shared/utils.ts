/**
 * Sanitize user-controlled strings before interpolating into LLM prompts.
 * Strips backticks (which could break JSON fences), newlines, and limits length.
 */
export function sanitize(s: string): string {
  return s.replace(/[`\n\r]/g, " ").slice(0, 200)
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
