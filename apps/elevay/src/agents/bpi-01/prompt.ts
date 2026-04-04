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
  serp: number
  press: number
  youtube: number
  social: number
  seo: number
  benchmark: number
  date: string
}

// ── System prompt — persona BPI-01 ───────────────────────────────────────────

export const SYSTEM_PROMPT = `You are BPI-01, Elevay's Brand Presence Intelligence agent.

You analyse a brand's online presence from structured data collected across 8 sources: SERP, press, YouTube, social media, SEO, competitive benchmark, Google Maps reputation, and Trustpilot reviews.

Your role: produce 6 business-language diagnostics (one per axis) and a prioritized list of 3-5 actions for the next 90 days.

LANGUAGE RULE: The JSON keys and axis values must stay in English. All diagnostic text, action descriptions, and source_problem explanations must be written in the language specified in the brand profile (profile.language). If profile.language is 'French' or 'fr', write all content in French. If 'English' or 'en', write in English.

ABSOLUTE RULE: respond ONLY with valid JSON. No text before or after. No markdown. No explanation. No \`\`\`json block. Raw JSON only.

If a data point is marked "INDISPONIBLE", ignore it in your analysis and note the limitation in the relevant diagnostic.`;

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
 * Le LLM doit retourner le fragment JSON { axis_diagnostics, priorities_90d }.
 * Les scores sont déjà calculés côté serveur et passés en contexte.
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
## SCORES CALCULÉS (6 axes : SERP 20% · Presse 15% · YouTube 15% · Social 15% · SEO 20% · Benchmark 15%)
- Score global        : ${scores.global}/100
- SERP (20%)          : ${scores.serp}/100
- Presse (15%)        : ${scores.press}/100
- YouTube (15%)       : ${scores.youtube}/100
- Social (15%)        : ${scores.social}/100
- SEO (20%)           : ${scores.seo}/100
- Benchmark (15%)     : ${scores.benchmark}/100${degradedNote}
`.trim();

  // ── Comparaison historique ────────────────────────────────────────────────
  const historicalSection = previousRun
    ? `
## COMPARAISON AVEC LE RUN PRÉCÉDENT (${previousRun.date})
- Global    : ${previousRun.global}/100 → ${scores.global}/100 (${deltaStr(scores.global, previousRun.global)})
- SERP      : ${previousRun.serp}/100 → ${scores.serp}/100 (${deltaStr(scores.serp, previousRun.serp)})
- Presse    : ${previousRun.press}/100 → ${scores.press}/100 (${deltaStr(scores.press, previousRun.press)})
- YouTube   : ${previousRun.youtube}/100 → ${scores.youtube}/100 (${deltaStr(scores.youtube, previousRun.youtube)})
- Social    : ${previousRun.social}/100 → ${scores.social}/100 (${deltaStr(scores.social, previousRun.social)})
- SEO       : ${previousRun.seo}/100 → ${scores.seo}/100 (${deltaStr(scores.seo, previousRun.seo)})
- Benchmark : ${previousRun.benchmark}/100 → ${scores.benchmark}/100 (${deltaStr(scores.benchmark, previousRun.benchmark)})
`.trim()
    : "";

  // ── Instructions et schéma de sortie ─────────────────────────────────────
  const instructions = `
## INSTRUCTIONS

À partir des données ci-dessus, génère UNIQUEMENT le JSON suivant (sans markdown, sans texte avant ou après) :

{
  "axis_diagnostics": [
    { "axis": "serp", "diagnostic": "..." },
    { "axis": "press", "diagnostic": "..." },
    { "axis": "youtube", "diagnostic": "..." },
    { "axis": "social", "diagnostic": "..." },
    { "axis": "seo", "diagnostic": "..." },
    { "axis": "benchmark", "diagnostic": "..." }
  ],
  "priorities_90d": [
    { "action": "...", "tag": "Urgent", "source_problem": "..." },
    { "action": "...", "tag": "Moyen terme", "source_problem": "..." },
    { "action": "...", "tag": "Quick win", "source_problem": "..." }
  ]
}

Règles :
- axis_diagnostics : exactement 6 diagnostics (un par axe). Chaque diagnostic est UNE PHRASE en langage business, compréhensible par un dirigeant non-technique. Pas de jargon SEO/marketing. Focus sur ce que ça signifie concrètement pour la marque.
- priorities_90d : 3 à 5 actions priorisées pour les 90 prochains jours
  - tag : "Urgent" (à faire cette semaine), "Moyen terme" (ce mois-ci), ou "Quick win" (facile et rapide)
  - source_problem : UNE PHRASE expliquant quelle donnée a révélé ce problème
- Priorise par impact réel sur la visibilité et la réputation de la marque
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
