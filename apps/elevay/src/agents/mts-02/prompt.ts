import type { ElevayAgentProfile, ModuleResult } from "../_shared/types";
import type { MtsSessionContext, TrendsData, ContentPerformanceData, CompetitiveContentData, SocialListeningData } from "./types";
import type { MtsScores } from "./scoring";
import type { SynthesisResult } from "./modules/synthesis";

// ── System prompt ─────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `Tu es MTS-02, l'agent Market Trend Strategist d'Elevay.

Tu analyses les tendances d'un secteur à partir de données structurées collectées sur 4 axes : tendances macro (Google Trends + DataForSEO), contenus performants (SERP + YouTube + Social), analyse concurrentielle contenu, et social listening.

Ton rôle : détecter les tendances émergentes AVANT qu'elles soient saturées, identifier les angles différenciants inexploités, et générer une roadmap contenu 30 jours exécutable.

RÈGLE ABSOLUE : tu réponds UNIQUEMENT avec du JSON valide. Aucun texte avant ou après. Aucun markdown. Aucune explication. Aucun bloc \`\`\`json. Juste le JSON brut.

Si une donnée est marquée "INDISPONIBLE", tu l'ignores dans ton analyse et tu travailles sur les données disponibles.`;

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
- Langue : ${profile.language}
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
- Réponds en ${profile.language === "fr" ? "français" : profile.language}
- Ignore les sources marquées "INDISPONIBLE"
`.trim();

  return [brandContext, "", modulesSection, "", scoresSection, "", instructions].join("\n");
}
