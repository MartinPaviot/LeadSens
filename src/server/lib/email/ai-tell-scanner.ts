/**
 * AI "tell" scanner for cold email quality gate.
 *
 * 47% of recipients ignore emails they suspect are AI-generated (Lavender 2026).
 * Three main tells: overly formal language, corporate buzzwords, repetitive structure.
 *
 * Same pattern as filler-phrases.ts — deterministic, zero LLM cost.
 */

// ─── Formal AI tells (case-insensitive, substring match) ──

export const FORMAL_TELLS = [
  "i would like to",
  "i am writing to",
  "pursuant to",
  "in regard to",
  "we are pleased to",
  "it is worth noting",
  "i wanted to take a moment",
  "allow me to",
  "i trust this",
  "please do not hesitate",
  "furthermore",
  "moreover",
  "additionally",
  "consequently",
  "it has come to my attention",
  "as per our",
  "hereby",
  "i would be delighted",
  "it is my pleasure",
  "i wish to inform",
] as const;

export const CORPORATE_BUZZWORDS = [
  "leverage",
  "synergy",
  "paradigm",
  "holistic",
  "streamline",
  "optimize",
  "scalable",
  "innovative",
  "cutting-edge",
  "best-in-class",
  "world-class",
  "industry-leading",
  "state-of-the-art",
  "game-changer",
  "next-generation",
  "transformative",
  "disruptive",
  "robust solution",
  "end-to-end",
  "value proposition",
] as const;

// ─── Types ──────────────────────────────────────────────────

export interface AiTellScanResult {
  /** Whether any AI tell was detected */
  flagged: boolean;
  /** The specific phrases that matched */
  matches: string[];
  /** Category of the primary match */
  category: "formal" | "corporate" | "repetitive" | null;
}

// ─── Scanner ────────────────────────────────────────────────

/**
 * Scan an email body for AI-generated tells.
 *
 * Three checks:
 * 1. Formal tells: 1 match = flagged (formal language = instant AI suspicion)
 * 2. Corporate buzzwords: 2+ matches = flagged (1 is tolerable)
 * 3. Repetitive structure: 3+ consecutive sentences starting with "We " or "Our "
 */
export function scanForAiTells(body: string): AiTellScanResult {
  const lower = body.toLowerCase();
  const matches: string[] = [];
  let category: AiTellScanResult["category"] = null;

  // 1. Formal tells — threshold 1
  for (const phrase of FORMAL_TELLS) {
    if (lower.includes(phrase)) {
      matches.push(phrase);
      if (!category) category = "formal";
    }
  }

  if (matches.length > 0) {
    return { flagged: true, matches, category };
  }

  // 2. Corporate buzzwords — threshold 2
  const buzzwordMatches: string[] = [];
  for (const word of CORPORATE_BUZZWORDS) {
    if (lower.includes(word)) {
      buzzwordMatches.push(word);
    }
  }

  if (buzzwordMatches.length >= 2) {
    return { flagged: true, matches: buzzwordMatches, category: "corporate" };
  }

  // 3. Repetitive sentence structure — 3+ consecutive "We " or "Our " starters
  const sentences = body
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let consecutive = 0;
  for (const sentence of sentences) {
    if (/^(we |our )/i.test(sentence)) {
      consecutive++;
      if (consecutive >= 3) {
        return {
          flagged: true,
          matches: [`${consecutive} consecutive sentences starting with "We/Our"`],
          category: "repetitive",
        };
      }
    } else {
      consecutive = 0;
    }
  }

  return { flagged: false, matches: [], category: null };
}
