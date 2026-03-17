/**
 * Spam word scanner for cold email quality gate.
 *
 * Emails with 3+ spam trigger words are 67% more likely to land in spam.
 * This scanner runs BEFORE the LLM quality gate (instant, zero cost).
 *
 * Context matters: modern AI-based filters evaluate patterns, not isolated words.
 * We check multi-word phrases first (more specific), then single words,
 * and only flag when the density crosses the threshold.
 *
 * Sources: RESEARCH-DELIVERABILITY-2026.md §7.3, §11.1 D1
 */

// ─── Trigger word list (100+ entries, categorized) ───────────────

/** Multi-word phrases checked first (case-insensitive, exact phrase match) */
export const SPAM_PHRASES = [
  // Financial promises
  "earn money",
  "instant cash",
  "get paid",
  "make money",
  "financial freedom",
  "double your",
  "cash bonus",
  "free money",
  "extra income",
  "money back",
  "big bucks",
  "easy money",
  "fast cash",
  "get rich",
  "million dollars",
  "revenue guarantee",
  "income opportunity",
  "work from home",

  // Urgency / pressure
  "act now",
  "limited time",
  "offer expires",
  "last chance",
  "don't miss",
  "don't delay",
  "expires today",
  "time limited",
  "once in a lifetime",
  "while supplies last",
  "what are you waiting for",
  "apply now",
  "sign up free",
  "order now",
  "buy now",
  "order today",
  "call now",

  // Too good to be true
  "risk-free",
  "no cost",
  "100% free",
  "no obligation",
  "you've been selected",
  "you have been selected",
  "no strings attached",
  "no catch",
  "no fees",
  "no hidden",
  "no purchase necessary",
  "satisfaction guaranteed",
  "money-back guarantee",
  "double your money",

  // Generic sales
  "special promotion",
  "exclusive deal",
  "best price",
  "lowest price",
  "click here",
  "click below",
  "open immediately",
  "important update",
  "account suspended",
  "verify now",
  "update required",
  "special offer",
  "limited offer",
  "act immediately",
  "amazing offer",
  "incredible deal",
  "unbeatable price",
  "save big",

  // Deceptive / phishing
  "dear friend",
  "as seen on",
  "not spam",
  "this is not spam",
  "bulk mail",
  "mass email",
  "multi-level marketing",
  "no questions asked",
  "opt-in",
] as const;

/** Single words checked after phrases (case-insensitive, word boundary match) */
export const SPAM_WORDS = [
  // Financial
  "viagra",
  "casino",
  "lottery",
  "jackpot",
  "bitcoin",
  "crypto",
  "forex",

  // Urgency
  "urgent",
  "hurry",

  // Overpromising
  "guaranteed",
  "unlimited",
  "congratulations",
  "winner",
  "prize",
  "miracle",

  // Sales pressure
  "bargain",
  "discount",
  "cheapest",
  "unsolicited",
  "unsubscribe",

  // Deceptive
  "hack",
  "hidden",
  "free",
  "giveaway",
] as const;

/**
 * Minimum number of matches to flag an email.
 * Research: 3+ triggers = 67% more likely to land in spam.
 */
export const SPAM_THRESHOLD = 3;

// ─── Scanner ─────────────────────────────────────────────────────

export interface SpamScanResult {
  /** Total number of spam trigger matches found */
  matchCount: number;
  /** The specific words/phrases that matched */
  matches: string[];
  /** Whether the email exceeds the spam threshold */
  flagged: boolean;
}

/**
 * Scan email subject + body for spam trigger words/phrases.
 *
 * 1. Normalizes text (lowercase, collapse whitespace)
 * 2. Checks multi-word phrases first (exact match)
 * 3. Checks single words (word boundary match)
 * 4. Deduplicates matches (same trigger only counted once)
 *
 * Returns a structured result — caller decides what to do with it.
 */
export function scanForSpamWords(subject: string, body: string): SpamScanResult {
  const text = `${subject} ${body}`.toLowerCase().replace(/\s+/g, " ");
  const matches: string[] = [];

  // Check multi-word phrases (exact substring match)
  for (const phrase of SPAM_PHRASES) {
    if (text.includes(phrase)) {
      matches.push(phrase);
    }
  }

  // Check single words (word boundary match to avoid false positives)
  // e.g. "discount" matches but "discovery" doesn't match "disco"
  for (const word of SPAM_WORDS) {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, "i");
    if (regex.test(text)) {
      matches.push(word);
    }
  }

  return {
    matchCount: matches.length,
    matches,
    flagged: matches.length >= SPAM_THRESHOLD,
  };
}

/** Escape special regex characters in a string */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
