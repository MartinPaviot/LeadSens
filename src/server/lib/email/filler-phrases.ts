/**
 * Filler phrase scanner for cold email quality gate.
 *
 * Generic opener phrases ("I came across your profile", "I hope this finds you well")
 * are actively harmful — prospects pattern-match them as templates and mentally delete
 * the email. A single filler opener is enough to kill reply rates.
 *
 * This scanner checks ONLY the first 2 sentences of the body (filler = opener problem).
 * Runs BEFORE the LLM quality gate (instant, zero cost).
 *
 * Sources: Reddit r/coldemail (Mar 9, 2026), LeadsMonky (Mar 4, 2026)
 */

// ─── Filler phrase blocklist (case-insensitive, substring match) ──

/**
 * Generic opener phrases that signal "mass template" to prospects.
 * Each phrase is something that could be sent to anyone without knowing
 * anything specific about them.
 *
 * NOT included: specific openers like "noticed you're hiring" or
 * "saw your recent funding round" — those reference real signals.
 */
export const FILLER_PHRASES = [
  // "I came across" family — the #1 template tell
  "i came across your profile",
  "i came across your company",
  "i came across your website",
  "i came across your work",

  // "I noticed" without specifics
  "i noticed you're doing great work",
  "i noticed you're doing amazing work",
  "i noticed you're doing incredible work",

  // "I hope" pleasantries
  "i hope this finds you well",
  "i hope this email finds you well",
  "i hope you're doing well",
  "i hope you're having a great",
  "hope you're doing well",
  "hope you're having a great",
  "hope this finds you well",

  // "Reaching out" without reason
  "i wanted to reach out",
  "i'm reaching out because",
  "i'm reaching out to",
  "just wanted to reach out",
  "just reaching out to",

  // Fake flattery
  "i admire what you're building",
  "i admire what you've built",
  "i was impressed by your",
  "i'm a big fan of your",
  "love what you're doing",
  "really love what you're doing",
  "love what you've built",

  // Vague discovery
  "i stumbled upon your",
  "i was looking at your",
  "i've been following your",

  // Generic check-ins (follow-ups)
  "just wanted to check in",
  "just checking in",
  "just following up on my last",
  "just bumping this up",
  "just wanted to bump this",
  "circling back on this",
] as const;

// ─── Scanner ─────────────────────────────────────────────────────

export interface FillerScanResult {
  /** Number of filler phrases found in the opener */
  matchCount: number;
  /** The specific phrases that matched */
  matches: string[];
  /** Whether any filler phrase was detected (threshold = 1) */
  flagged: boolean;
}

/**
 * Extract the first N sentences from the body for scanning.
 * Strips greeting lines (Hi X, Hey X, Hello X) before extracting.
 */
export function extractOpener(body: string, sentenceCount = 2): string {
  // Normalize line breaks
  const lines = body
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Skip greeting lines (Hi Name, Hey Name, Hello Name, Dear Name)
  const greetingPattern = /^(hi|hey|hello|dear|bonjour|salut)\b/i;
  const substantiveLines: string[] = [];
  let pastGreeting = false;

  for (const line of lines) {
    if (!pastGreeting && greetingPattern.test(line)) {
      pastGreeting = true;
      continue;
    }
    pastGreeting = true;
    substantiveLines.push(line);
  }

  // Join and split into sentences
  const text = substantiveLines.join(" ");
  // Split on sentence endings: period, exclamation, question mark followed by space or end
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 0);

  return sentences.slice(0, sentenceCount).join(" ").toLowerCase();
}

/**
 * Scan the first 2 sentences of an email body for filler phrases.
 *
 * Unlike spam words (threshold = 3), a SINGLE filler phrase is enough
 * to flag the email — one generic opener kills the entire impression.
 *
 * Only scans the opener (first 2 sentences after greeting) because
 * filler phrases are exclusively an opener problem.
 */
export function scanForFillerPhrases(body: string): FillerScanResult {
  const opener = extractOpener(body);
  const matches: string[] = [];

  for (const phrase of FILLER_PHRASES) {
    if (opener.includes(phrase)) {
      matches.push(phrase);
    }
  }

  return {
    matchCount: matches.length,
    matches,
    flagged: matches.length > 0,
  };
}
