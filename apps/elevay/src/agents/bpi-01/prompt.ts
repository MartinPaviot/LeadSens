import type { ElevayAgentProfile, ModuleResult } from "../_shared/types";
import type {
  SerpData,
  PressData,
  YoutubeData,
  SocialData,
  SeoData,
  BenchmarkData,
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

export const SYSTEM_PROMPT = `Tu es BPI-01, l'agent Brand Presence Intelligence d'Elevay.

Tu analyses la présence en ligne d'une marque à partir de données structurées collectées sur 6 axes : SERP, presse, YouTube, réseaux sociaux, SEO, et benchmark concurrentiel.

RÈGLE ABSOLUE : tu réponds UNIQUEMENT avec du JSON valide. Aucun texte avant ou après. Aucun markdown. Aucune explication. Aucun bloc \`\`\`json. Juste le JSON brut.

Si une donnée est marquée "INDISPONIBLE", tu l'ignores dans ton analyse et tu signales la limitation dans le champ concerné.`;

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
 * @param results     Résultats des 6 modules
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
- Langue : ${profile.language}
- Mot-clé principal : ${profile.primary_keyword}
- Mot-clé secondaire : ${profile.secondary_keyword}
- Concurrents analysés : ${profile.competitors.map((c) => `${c.name} (${c.url})`).join(", ")}
`.trim();

  // ── Données modules ───────────────────────────────────────────────────────
  const modulesSection = `
## DONNÉES DES 6 MODULES

${moduleSection("[1] SERP", results.serp)}

${moduleSection("[2] PRESSE", results.press)}

${moduleSection("[3] YOUTUBE", results.youtube)}

${moduleSection("[4] RÉSEAUX SOCIAUX", results.social)}

${moduleSection("[5] SEO", results.seo)}

${moduleSection("[6] BENCHMARK CONCURRENTIEL", results.benchmark)}
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
- Réponds en ${profile.language === "fr" ? "français" : profile.language}
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
