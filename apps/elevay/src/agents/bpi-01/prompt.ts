import type { ElevayAgentProfile, ModuleResult } from "../_shared/types";
import { formatLanguage } from "../_shared/utils";
import type {
  SerpData,
  PressData,
  YoutubeData,
  SocialData,
  SeoData,
  BenchmarkData,
  GoogleMapsData,
  TrustpilotData,
} from "./types";
import type { BpiScores } from "./scoring";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ModuleResults {
  serp: ModuleResult<SerpData> | null
  press: ModuleResult<PressData> | null
  youtube: ModuleResult<YoutubeData> | null
  social: ModuleResult<SocialData> | null
  seo: ModuleResult<SeoData> | null
  benchmark: ModuleResult<BenchmarkData> | null
  googleMaps: ModuleResult<GoogleMapsData> | null
  trustpilot: ModuleResult<TrustpilotData> | null
}

interface PreviousScores {
  global: number
  reputation: number
  visibility: number
  social: number
  competitive: number
  date: string
}

// ── System prompt — persona BPI-01 ───────────────────────────────────────────

export const SYSTEM_PROMPT = `You are BPI-01, Elevay's Brand Presence Intelligence agent.

You analyse a brand's online presence from structured data collected across 8 axes: SERP, press, YouTube, social media, SEO, competitive benchmark, Google Maps reputation, and Trustpilot reviews.

LANGUAGE RULE: The report structure, labels and section titles must be in English. All analysis content, recommendations, insights and actionable items must be written in the language specified in the brand profile (profile.language). If profile.language is 'French' or 'fr', write all content in French. If 'English' or 'en', write in English.

ABSOLUTE RULE: respond ONLY with valid JSON. No text before or after. No markdown. No explanation. No \`\`\`json block. Raw JSON only.

If a data point is marked "INDISPONIBLE", ignore it in your analysis and note the limitation in the relevant field.`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function moduleSection<T>(
  label: string,
  result: ModuleResult<T> | null,
): string {
  if (!result || !result.data) return `${label} : INDISPONIBLE`;
  const degradedNote = result.degraded ? " (données partielles)" : "";
  return `${label}${degradedNote} :\n${JSON.stringify(result.data, null, 2)}`;
}

function deltaStr(current: number, previous: number): string {
  const d = current - previous;
  return d > 0 ? `+${d}` : `${d}`;
}

// ── buildConsolidatedPrompt ───────────────────────────────────────────────────

/**
 * Construit le prompt utilisateur envoyé à Claude (1 seul appel LLM par audit).
 * Le LLM doit retourner le fragment JSON { top_risks, quick_wins, roadmap_90d }.
 * Les scores sont déjà calculés côté serveur et passés en contexte.
 *
 * @param profile     Profil de la marque
 * @param results     Résultats des 7 modules
 * @param scores      Scores calculés par calculateBpiScores
 * @param previousRun Scores du run précédent (comparaison historique)
 */
export function buildConsolidatedPrompt(
  profile: ElevayAgentProfile,
  results: ModuleResults,
  scores: BpiScores,
  previousRun?: PreviousScores,
): string {
  // ── Contexte marque ───────────────────────────────────────────────────────
  const brandContext = `
## CONTEXTE DE LA MARQUE
- Nom : ${profile.brand_name}
- URL : ${profile.brand_url}
- Pays : ${profile.country}
- LANGUAGE: ${profile.language || 'English'}
- Mot-clé principal : ${profile.primary_keyword}
- Mot-clé secondaire : ${profile.secondary_keyword}
- Concurrents analysés : ${profile.competitors.map((c) => `${c.name} (${c.url})`).join(", ")}
`.trim();

  // ── Google Maps — section textuelle formatée ──────────────────────────────
  function googleMapsSection(): string {
    const r = results.googleMaps;
    if (!r?.data?.found) return "[7] GOOGLE MAPS RÉPUTATION : INDISPONIBLE";
    const d = r.data;
    const total = (d.sentiment?.positive ?? 0) + (d.sentiment?.neutral ?? 0) + (d.sentiment?.negative ?? 0);
    const positiveRate = total > 0 ? Math.round(((d.sentiment?.positive ?? 0) / total) * 100) : 0;
    const negativeRate = total > 0 ? Math.round(((d.sentiment?.negative ?? 0) / total) * 100) : 0;
    const lines = [
      `[7] GOOGLE MAPS RÉPUTATION :`,
      `- Note : ${d.rating}/5 (${d.review_count} avis)`,
      `- Score réputation : ${d.reputation_score}/100`,
      `- Sentiment : ${positiveRate}% positif, ${negativeRate}% négatif`,
    ];
    if (d.top_positive_reviews?.length) {
      lines.push(`- Top avis positifs :`);
      d.top_positive_reviews.forEach((t) => lines.push(`  • "${t.slice(0, 120)}..."`));
    }
    if (d.top_negative_reviews?.length) {
      lines.push(`- Top avis négatifs :`);
      d.top_negative_reviews.forEach((t) => lines.push(`  • "${t.slice(0, 120)}..."`));
    }
    lines.push(
      "",
      "Instructions : Analyze Google Maps reputation data. Identify key themes in positive and negative reviews.",
      "Highlight reputation risks and opportunities.",
    );
    return lines.join("\n");
  }

  // ── Données modules ───────────────────────────────────────────────────────
  const modulesSection = `
## DONNÉES DES 8 MODULES

${moduleSection("[1] SERP", results.serp)}

${moduleSection("[2] PRESSE", results.press)}

${moduleSection("[3] YOUTUBE", results.youtube)}

${moduleSection("[4] RÉSEAUX SOCIAUX", results.social)}

${moduleSection("[5] SEO", results.seo)}

${moduleSection("[6] BENCHMARK CONCURRENTIEL", results.benchmark)}

${googleMapsSection()}

${moduleSection("[8] TRUSTPILOT REPUTATION", results.trustpilot)}
`.trim();

  // ── Scores calculés ───────────────────────────────────────────────────────
  const degradedNote =
    Object.values(results).some((r) => r === null || r?.degraded)
      ? "\n⚠️ Score calculé sur données partielles — certaines sources indisponibles."
      : "";

  const scoresSection = `
## SCORES CALCULÉS (pondération : Réputation 35% · Visibilité 30% · Social 20% · Compétitif 15%)
- Score global      : ${scores.global}/100
- Réputation (35%)  : ${scores.reputation}/100
- Visibilité (30%)  : ${scores.visibility}/100
- Social (20%)      : ${scores.social}/100
- Compétitif (15%)  : ${scores.competitive}/100${degradedNote}
`.trim();

  // ── Comparaison historique ────────────────────────────────────────────────
  const historicalSection = previousRun
    ? `
## COMPARAISON AVEC LE RUN PRÉCÉDENT (${previousRun.date})
- Global      : ${previousRun.global}/100 → ${scores.global}/100 (${deltaStr(scores.global, previousRun.global)})
- Réputation  : ${previousRun.reputation}/100 → ${scores.reputation}/100 (${deltaStr(scores.reputation, previousRun.reputation)})
- Visibilité  : ${previousRun.visibility}/100 → ${scores.visibility}/100 (${deltaStr(scores.visibility, previousRun.visibility)})
- Social      : ${previousRun.social}/100 → ${scores.social}/100 (${deltaStr(scores.social, previousRun.social)})
- Compétitif  : ${previousRun.competitive}/100 → ${scores.competitive}/100 (${deltaStr(scores.competitive, previousRun.competitive)})
`.trim()
    : "";

  // ── Instructions et schéma de sortie ─────────────────────────────────────
  const instructions = `
## INSTRUCTIONS

À partir des données ci-dessus, génère UNIQUEMENT le JSON suivant (sans markdown, sans texte avant ou après) :

{
  "top_risks": [
    // 5 items maximum — urgency: "high" | "medium" | "low"
    { "description": "...", "urgency": "high", "source": "SERP|presse|youtube|social|SEO|benchmark" }
  ],
  "quick_wins": [
    // 5 items maximum — effort: "low" | "medium" | "high", impact: "high" | "medium" | "low"
    { "action": "...", "impact": "high", "effort": "low", "estimated_time": "2h" }
  ],
  "roadmap_90d": [
    // Exactement 3 phases : Mois 1, Mois 2, Mois 3
    { "phase": 1, "label": "Mois 1 — ...", "objective": "...", "actions": ["...", "...", "..."] },
    { "phase": 2, "label": "Mois 2 — ...", "objective": "...", "actions": ["...", "...", "..."] },
    { "phase": 3, "label": "Mois 3 — ...", "objective": "...", "actions": ["...", "...", "..."] }
  ]
}

Règles :
- Priorise les risques par urgence réelle basée sur les données (pas générique)
- Les quick wins doivent être actionnables en moins de 1 semaine (effort "low") ou 1 mois (effort "medium")
- La roadmap 90j doit suivre une logique de progression : stabilisation → accélération → scaling
- Réponds en ${formatLanguage(profile.language)}
`.trim();

  return [
    brandContext,
    "",
    modulesSection,
    "",
    scoresSection,
    historicalSection ? "" : null,
    historicalSection || null,
    "",
    instructions,
  ]
    .filter((s) => s !== null)
    .join("\n");
}
