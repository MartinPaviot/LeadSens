/**
 * Thompson Sampling for A/B subject line pattern optimization.
 *
 * Uses Beta distribution sampling to balance exploration vs exploitation.
 * Patterns with more sends + replies get exploited; patterns with few sends
 * get explored. This converges faster than epsilon-greedy or UCB.
 *
 * Reference: Chapelle & Li (2011), "An Empirical Evaluation of Thompson Sampling"
 */

/**
 * Sample from a Gamma(shape, 1) distribution using Marsaglia & Tsang's method.
 * Works for shape >= 1. For shape < 1, use the identity:
 *   Gamma(shape) = Gamma(shape+1) * U^(1/shape)
 */
function gammaSample(shape: number): number {
  if (shape < 1) {
    return gammaSample(shape + 1) * Math.pow(Math.random(), 1.0 / shape);
  }

  const d = shape - 1.0 / 3.0;
  const c = 1.0 / Math.sqrt(9.0 * d);

  for (;;) {
    let x: number, v: number;
    do {
      // Box-Muller for standard normal
      const u1 = Math.random();
      const u2 = Math.random();
      x = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      v = 1.0 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = Math.random();

    if (u < 1.0 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1.0 - v + Math.log(v))) return d * v;
  }
}

/**
 * Sample from a Beta(alpha, beta) distribution.
 * Uses the Gamma distribution identity: Beta(a,b) = Ga/(Ga+Gb).
 * Works for all positive alpha, beta values.
 */
function betaSample(alpha: number, beta: number): number {
  const ga = gammaSample(alpha);
  const gb = gammaSample(beta);
  return ga / (ga + gb);
}

export interface PatternStats {
  name: string;
  sent: number;
  replied: number;
}

export interface RankedPattern {
  name: string;
  score: number;
}

/**
 * Rank subject line patterns using Thompson Sampling.
 *
 * Each pattern's performance is modeled as Beta(replied + 1, sent - replied + 1).
 * We sample from each pattern's posterior and rank by the sample.
 * This naturally balances exploitation (high-performing patterns) with
 * exploration (patterns with few data points).
 *
 * @param patterns - Array of pattern stats (name, sent, replied)
 * @returns Sorted array with Thompson sample scores (highest first)
 */
export function rankPatternsByThompson(patterns: PatternStats[]): RankedPattern[] {
  if (patterns.length === 0) return [];

  return patterns
    .map((p) => ({
      name: p.name,
      score: betaSample(p.replied + 1, p.sent - p.replied + 1),
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Format ranked patterns for injection into the email prompt.
 * Returns empty string if not enough data.
 */
export function formatPatternRanking(
  patterns: PatternStats[],
  minTotalSent: number = 30,
): string {
  const totalSent = patterns.reduce((sum, p) => sum + p.sent, 0);
  if (totalSent < minTotalSent || patterns.length < 2) return "";

  const ranked = rankPatternsByThompson(patterns);

  const lines = ["## SUBJECT LINE PATTERNS (ordered by your performance)"];
  for (let i = 0; i < ranked.length; i++) {
    const p = ranked[i];
    const stats = patterns.find((s) => s.name === p.name);
    const replyRate = stats && stats.sent > 0
      ? ((stats.replied / stats.sent) * 100).toFixed(1)
      : "0.0";
    const star = i === 0 ? " ★" : "";
    lines.push(`${i + 1}. ${p.name}${star} (${replyRate}% reply, ${stats?.sent ?? 0} sends)`);
  }
  lines.push("Use patterns 1, 2, 3 for your 3 subject variants.");

  return lines.join("\n");
}
