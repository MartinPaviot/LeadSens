/**
 * Shared utilities for agent modules.
 */

const LANGUAGE_MAP: Record<string, string> = {
  fr: 'français',
  en: 'english',
  es: 'español',
  de: 'deutsch',
};

/** Convert ISO language code to human-readable name for LLM prompts. */
export function formatLanguage(lang: string): string {
  return LANGUAGE_MAP[lang] ?? lang;
}
