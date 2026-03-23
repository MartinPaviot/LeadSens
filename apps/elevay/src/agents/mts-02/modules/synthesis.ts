import type { ModuleResult } from "../../_shared/types";
import type {
  ContentGap,
  ContentPerformanceData,
  CompetitiveContentData,
  FormatEntry,
  SocialListeningData,
  SocialSignal,
  TrendingTopic,
  TrendsData,
} from "../types";

// ── Inputs / Outputs ──────────────────────────────────────────────────────────

export interface SynthesisInput {
  trends: ModuleResult<TrendsData> | null
  content: ModuleResult<ContentPerformanceData> | null
  competitive: ModuleResult<CompetitiveContentData> | null
  socialListening: ModuleResult<SocialListeningData> | null
}

export interface SynthesisResult {
  trending_topics: TrendingTopic[]
  saturated_topics: Array<{ topic: string; reason: string }>
  content_gap_map: ContentGap[]
  format_matrix: FormatEntry[]
  social_signals: SocialSignal[]
  opportunity_scores: Record<string, number>
  differentiating_angles: string[]
}

// ── Scoring spec §4.1 ─────────────────────────────────────────────────────────

interface TopicScoreInput {
  keyword: string
  volume: number
  difficulty: number
  growth_30d: number
  competitorCoverage: "none" | "low" | "medium" | "high"
  socialPostCount: number
}

function computeOpportunityScore(input: TopicScoreInput): number {
  // Dimension 1 — Croissance Google Trends (max 25)
  let d1 = 0;
  if (input.growth_30d >= 30) d1 = 25;
  else if (input.growth_30d >= 0) d1 = 10;
  else d1 = 0;

  // Dimension 2 — Volume search vs difficulté (max 25)
  let d2 = 0;
  if (input.volume >= 1000 && input.difficulty < 40) d2 = 25;
  else if (input.volume >= 500 || input.difficulty < 60) d2 = 15;
  else d2 = 10;

  // Dimension 3 — Couverture concurrentielle (max 25)
  let d3 = 0;
  switch (input.competitorCoverage) {
    case "none": d3 = 25; break;
    case "low":  d3 = 20; break;
    case "medium": d3 = 15; break;
    case "high": d3 = 5;  break;
  }

  // Dimension 4 — Traction sociale (max 25)
  let d4 = 0;
  if (input.socialPostCount >= 10) d4 = 25;
  else if (input.socialPostCount >= 5) d4 = 15;
  else d4 = 5;

  return d1 + d2 + d3 + d4;
}

// ── Classification spec §4.3 ──────────────────────────────────────────────────

function classifyTopic(
  score: number,
  growth_30d: number,
  competitorCoverage: string,
): TrendingTopic["classification"] {
  if (competitorCoverage === "high" && score < 50) return "saturation";
  if (growth_30d > 50 && score >= 70) return "buzz";  // pic soudain
  if (score >= 70) return "strong_trend";
  if (score >= 40) return "weak_signal";
  return "saturation";
}

function estimateHorizon(classification: TrendingTopic["classification"]): string {
  switch (classification) {
    case "weak_signal":   return "4-8 semaines";
    case "strong_trend":  return "3-6 mois";
    case "buzz":          return "< 2 semaines";
    case "saturation":    return "déjà saturé";
  }
}

// ── Format matrix ─────────────────────────────────────────────────────────────

function buildFormatMatrix(
  content: ContentPerformanceData | null,
  socialListening: SocialListeningData | null,
): FormatEntry[] {
  const matrix: FormatEntry[] = [];

  const canals = ["SEO", "YouTube", "LinkedIn", "TikTok", "X"] as const;
  for (const canal of canals) {
    const format = content?.dominant_formats[canal] ?? "article";
    const tone = content?.dominant_tones[canal] ?? "informatif";

    let example = "";
    if (canal === "SEO") {
      example = `Guide complet : ${content?.serp_top_content[0]?.title ?? "..."}`;
    } else if (canal === "YouTube") {
      example = content?.youtube_trending[0]?.title ?? "Vidéo éducative secteur";
    } else {
      // Chercher un exemple dans social listening
      const signals =
        canal === "LinkedIn" ? socialListening?.linkedin_signals :
        canal === "TikTok"   ? socialListening?.tiktok_signals :
        socialListening?.x_signals;
      const hook = signals?.[0]?.trending_hooks[0];
      example = hook ?? `Post ${format} — ${canal}`;
    }

    matrix.push({ canal, dominant_format: format, dominant_tone: tone, example });
  }

  return matrix;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function runSynthesis(input: SynthesisInput): SynthesisResult {
  const trendsData = input.trends?.data;
  const contentData = input.content?.data;
  const competitiveData = input.competitive?.data;
  const socialData = input.socialListening?.data;

  const allKeywords = [
    ...(trendsData?.rising_keywords ?? []),
    ...(trendsData?.stable_keywords ?? []),
  ];

  // Construire coverage map pour chaque keyword
  const coverageMap = new Map<string, ContentGap["competitor_coverage"]>();
  for (const gap of competitiveData?.content_gaps ?? []) {
    coverageMap.set(gap.topic, gap.competitor_coverage);
  }
  for (const angle of competitiveData?.saturated_angles ?? []) {
    coverageMap.set(angle, "high");
  }

  // Nombre de posts sociaux par sujet (approximation)
  const allSocialSignals = [
    ...(socialData?.linkedin_signals ?? []),
    ...(socialData?.tiktok_signals ?? []),
    ...(socialData?.x_signals ?? []),
  ].filter((s) => s.available);

  // Pour chaque keyword, calculer le score
  const opportunity_scores: Record<string, number> = {};
  const trending_topics: TrendingTopic[] = [];
  const saturated_topics: Array<{ topic: string; reason: string }> = [];

  for (const kw of allKeywords) {
    const coverage = coverageMap.get(kw.keyword) ?? "medium";
    // Estimer la traction sociale par le nombre de plateformes disponibles × 5
    const socialPostCount = allSocialSignals.length * 5;

    const score = computeOpportunityScore({
      keyword: kw.keyword,
      volume: kw.volume,
      difficulty: kw.difficulty,
      growth_30d: kw.growth_30d,
      competitorCoverage: coverage,
      socialPostCount,
    });

    opportunity_scores[kw.keyword] = score;

    const classification = classifyTopic(score, kw.growth_30d, coverage);

    if (classification === "saturation") {
      saturated_topics.push({
        topic: kw.keyword,
        reason: `Couverture concurrentielle ${coverage} — score ${score}/100`,
      });
      continue;
    }

    // Ne pas inclure les topics < 40 dans la roadmap
    if (score < 40) {
      saturated_topics.push({
        topic: kw.keyword,
        reason: `Score d'opportunité trop faible (${score}/100)`,
      });
      continue;
    }

    const sources: string[] = [];
    if (kw.growth_30d > 10) sources.push("Google Trends");
    if (kw.volume > 0) sources.push("DataForSEO");
    if (coverage === "none" || coverage === "low") sources.push("Competitive gap");

    trending_topics.push({
      topic: kw.keyword,
      opportunity_score: score,
      classification,
      source_confirmation: sources,
      estimated_horizon: estimateHorizon(classification),
      suggested_angle: competitiveData?.missing_angles[0] ?? `${kw.keyword} — angle différenciant`,
    });
  }

  // Trier par score desc
  trending_topics.sort((a, b) => b.opportunity_score - a.opportunity_score);

  // Top 3 angles différenciants (missing_angles à fort score)
  const differentiating_angles = (competitiveData?.missing_angles ?? [])
    .filter((angle) => {
      const score = opportunity_scores[angle] ?? 50;
      return score >= 40;
    })
    .slice(0, 3);

  // Content gap map — depuis competitive module
  const content_gap_map: ContentGap[] = competitiveData?.content_gaps ?? [];

  // Format matrix
  const format_matrix = buildFormatMatrix(contentData ?? null, socialData ?? null);

  // All social signals flatten
  const social_signals: SocialSignal[] = [
    ...(socialData?.linkedin_signals ?? []),
    ...(socialData?.tiktok_signals ?? []),
    ...(socialData?.x_signals ?? []),
  ];

  return {
    trending_topics,
    saturated_topics,
    content_gap_map,
    format_matrix,
    social_signals,
    opportunity_scores,
    differentiating_angles,
  };
}
