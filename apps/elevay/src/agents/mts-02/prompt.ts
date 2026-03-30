import type { ElevayAgentProfile, ModuleResult } from "../_shared/types";
import type { MtsSessionContext, TrendsData, ContentPerformanceData, CompetitiveContentData, SocialListeningData } from "./types";
import type { MtsScores } from "./scoring";
import { formatLanguage } from "../_shared/utils";
import type { SynthesisResult } from "./modules/synthesis";

// ── System prompt ─────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are MTS-02, Elevay's Market Trend Strategist agent.

You analyse sector trends from structured data collected across 4 axes: macro trends (Google Trends + DataForSEO), high-performing content (SERP + YouTube + Social), competitive content analysis, and social listening.

Your role: detect emerging trends BEFORE they are saturated, identify unexploited differentiating angles, and generate an executable 30-day content roadmap.

LANGUAGE RULE: The report structure, labels and section titles must be in English. All analysis content, recommendations, insights and actionable items must be written in the language specified in the brand profile (profile.language). If profile.language is 'French' or 'fr', write all content in French. If 'English' or 'en', write in English.

ABSOLUTE RULE: respond ONLY with valid JSON. No text before or after. No markdown. No explanation. No \`\`\`json block. Raw JSON only.

If a data point is marked "INDISPONIBLE", ignore it in your analysis and work with available data.`;

// ── Types ────────────────────────────────────────────────────────────────────

export interface ModuleResults {
  trends: ModuleResult<TrendsData> | null
  content: ModuleResult<ContentPerformanceData> | null
  competitive: ModuleResult<CompetitiveContentData> | null
  socialListening: ModuleResult<SocialListeningData> | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function moduleSection<T>(label: string, result: ModuleResult<T> | null): string {
  if (!result || !result.data) return `${label} : INDISPONIBLE`;
  const degradedNote = result.degraded ? " (données partielles)" : "";
  return `${label}${degradedNote} :\n${JSON.stringify(result.data, null, 2)}`;
}

// ── buildConsolidatedPrompt ───────────────────────────────────────────────────

/**
 * Construit le prompt envoyé à Claude (1 seul appel LLM par analyse).
 * Le LLM génère : trending_topics, saturated_topics, differentiating_angles,
 * roadmap_30d, format_matrix.
 * Les scores sont déjà calculés côté serveur et passés en contexte.
 */
export function buildConsolidatedPrompt(
  profile: ElevayAgentProfile,
  context: MtsSessionContext,
  results: ModuleResults,
  synthesis: SynthesisResult,
  scores: MtsScores,
): string {
  // ── Contexte ──────────────────────────────────────────────────────────────
  const brandContext = `
## CONTEXTE
- Marque : ${profile.brand_name}
- URL : ${profile.brand_url}
- Pays : ${profile.country}
- LANGUAGE: ${profile.language || 'English'}
- Secteur analysé : ${context.sector}
- Canaux prioritaires : ${context.priority_channels.join(", ")}
- Mot-clé principal : ${profile.primary_keyword}
- Mot-clé secondaire : ${profile.secondary_keyword}
- Concurrents : ${profile.competitors.map((c) => `${c.name} (${c.url})`).join(", ")}
`.trim();

  // ── Données modules ───────────────────────────────────────────────────────
  const modulesSection = `
## DONNÉES DES 4 MODULES

${moduleSection("[1] TENDANCES MACRO (Google Trends + DataForSEO)", results.trends)}

${moduleSection("[2] CONTENUS PERFORMANTS (SERP + YouTube + Social)", results.content)}

${moduleSection("[3] ANALYSE CONCURRENTIELLE CONTENU", results.competitive)}

${moduleSection("[4] SOCIAL LISTENING (LinkedIn + TikTok + X)", results.socialListening)}
`.trim();

  // ── Scores pré-calculés ───────────────────────────────────────────────────
  const topTopics = Object.entries(synthesis.opportunity_scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, score]) => `  - ${topic} : ${score}/100`)
    .join("\n");

  const scoresSection = `
## SCORES D'OPPORTUNITÉ (calculés côté serveur)
Top topics par score (0-100) :
${topTopics || "  Aucun topic scoré"}

Angles différenciants pré-identifiés (non couverts par concurrents) :
${synthesis.differentiating_angles.map((a) => `  - ${a}`).join("\n") || "  Aucun angle identifié"}

Topics saturés (à exclure de la roadmap) :
${synthesis.saturated_topics.map((t) => `  - ${t.topic} : ${t.reason}`).join("\n") || "  Aucun"}
`.trim();

  // ── Instructions ──────────────────────────────────────────────────────────
  const instructions = `
## INSTRUCTIONS

À partir des données ci-dessus, génère UNIQUEMENT le JSON suivant (sans markdown, sans texte avant ou après) :

{
  "trending_topics": [
    // Topics avec score ≥ 40 uniquement — max 8
    {
      "topic": "...",
      "opportunity_score": 75,
      "classification": "strong_trend",   // weak_signal | strong_trend | saturation | buzz
      "source_confirmation": ["Google Trends", "DataForSEO", "Competitive gap"],
      "estimated_horizon": "3-6 mois",
      "suggested_angle": "..."
    }
  ],
  "saturated_topics": [
    // Topics à éviter — max 5
    { "topic": "...", "reason": "..." }
  ],
  "differentiating_angles": [
    // 3 angles maximum — formulés directement, actionnables
    "...", "...", "..."
  ],
  "roadmap_30d": [
    // 4 semaines × canaux prioritaires (focus : ${context.priority_channels.join(", ")})
    {
      "week": 1,
      "canal": "LinkedIn",
      "format": "carrousel",
      "suggested_title": "...",
      "topic": "...",
      "priority": "high"   // high | medium | low
    }
  ],
  "format_matrix": [
    // 1 entrée par canal pertinent
    {
      "canal": "LinkedIn",
      "dominant_format": "carrousel",
      "dominant_tone": "didactique",
      "example": "..."
    }
  ]
}

Règles :
- Priorise les topics par score d'opportunité (données fournies ci-dessus)
- Les topics saturés ne doivent PAS apparaître dans trending_topics ni dans la roadmap
- La roadmap doit couvrir les 4 semaines avec une progression logique : signal faible → tendance forte
- Les titres suggérés doivent être concrets, pas génériques
- Volume roadmap selon canal : LinkedIn 3-4 posts/sem, SEO 2-3 articles/mois, YouTube 1-2 vidéos/mois
- Réponds en ${formatLanguage(profile.language)}
- Ignore les sources marquées "INDISPONIBLE"
`.trim();

  return [brandContext, "", modulesSection, "", scoresSection, "", instructions].join("\n");
}
