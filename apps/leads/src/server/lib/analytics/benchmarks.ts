/**
 * Industry benchmarks for cold email performance.
 *
 * Sources: Instantly benchmarks 2025, Woodpecker 2025, Lemlist 2025,
 * QuickMail State of Cold Email 2025. Conservative ranges (lower bound).
 *
 * Reply rates are for cold outbound email sequences (not warm/inbound).
 */

export interface IndustryBenchmark {
  /** Expected reply rate range [low, high] as percentages */
  replyRate: [number, number];
}

export const INDUSTRY_BENCHMARKS: Record<string, IndustryBenchmark> = {
  "SaaS": { replyRate: [8, 12] },
  "Fintech": { replyRate: [5, 8] },
  "Healthcare": { replyRate: [4, 7] },
  "E-commerce": { replyRate: [6, 9] },
  "Recruiting": { replyRate: [8, 13] },
  "Consulting": { replyRate: [7, 11] },
  "Manufacturing": { replyRate: [4, 7] },
  "Marketing": { replyRate: [7, 10] },
  "Real Estate": { replyRate: [6, 10] },
  "Financial": { replyRate: [5, 8] },
  "Insurance": { replyRate: [4, 7] },
  "Legal": { replyRate: [5, 8] },
  "Education": { replyRate: [5, 9] },
  "Technology": { replyRate: [7, 11] },
  "Logistics": { replyRate: [5, 8] },
  "Cybersecurity": { replyRate: [6, 10] },
  "AI": { replyRate: [7, 11] },
  "HR": { replyRate: [6, 9] },
  "Media": { replyRate: [5, 8] },
  "Retail": { replyRate: [5, 8] },
};

/**
 * Fuzzy-match an industry string to our benchmark table.
 * Uses lowercase substring matching for flexibility.
 */
export function findBenchmark(industry: string | null | undefined): IndustryBenchmark | null {
  if (!industry) return null;
  const lower = industry.toLowerCase();

  // Direct match
  for (const [key, benchmark] of Object.entries(INDUSTRY_BENCHMARKS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return benchmark;
    }
  }

  // Common aliases
  const aliases: Record<string, string> = {
    "software": "SaaS",
    "saas": "SaaS",
    "b2b saas": "SaaS",
    "finance": "Financial",
    "banking": "Financial",
    "ecommerce": "E-commerce",
    "health": "Healthcare",
    "medical": "Healthcare",
    "pharma": "Healthcare",
    "staffing": "Recruiting",
    "talent": "Recruiting",
    "agency": "Marketing",
    "advertising": "Marketing",
    "security": "Cybersecurity",
    "infosec": "Cybersecurity",
    "artificial intelligence": "AI",
    "machine learning": "AI",
    "human resources": "HR",
    "supply chain": "Logistics",
    "shipping": "Logistics",
    "property": "Real Estate",
    "law": "Legal",
    "edtech": "Education",
    "tech": "Technology",
  };

  for (const [alias, key] of Object.entries(aliases)) {
    if (lower.includes(alias)) {
      return INDUSTRY_BENCHMARKS[key] ?? null;
    }
  }

  return null;
}

/**
 * Generate a benchmark context string for an LLM report.
 * Returns null if no matching benchmark found.
 */
export function getBenchmarkContext(
  industry: string | null | undefined,
  replyRate: number,
): string | null {
  const benchmark = findBenchmark(industry);
  if (!benchmark) return null;

  const [low, high] = benchmark.replyRate;

  if (replyRate < low) {
    return `Your ${replyRate.toFixed(1)}% reply rate in ${industry} is below the ${low}-${high}% industry benchmark. Focus on signal quality, subject lines, and enrichment depth.`;
  } else if (replyRate > high) {
    return `Your ${replyRate.toFixed(1)}% reply rate in ${industry} exceeds the ${low}-${high}% industry benchmark. You're outperforming the market.`;
  } else {
    return `Your ${replyRate.toFixed(1)}% reply rate in ${industry} is within the ${low}-${high}% industry benchmark. Room to push toward the top.`;
  }
}
