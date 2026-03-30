import type { ElevayAgentProfile, ModuleResult } from "../_shared/types";
import { formatLanguage } from "../_shared/utils";
import type {
  CiaSessionContext,
  ProductMessagingData,
  SeoAcquisitionData,
  SocialMediaData,
  ContentAnalysisData,
  BenchmarkData,
  RecommendationsContext,
} from "./types";

// ── System prompt ─────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are CIA-03, Elevay's Competitive Intelligence Architect agent.

You analyse a brand's competitive positioning across 5 axes: product messaging, SEO acquisition, social media presence, content strategy, and global benchmark.

Your role: identify priority threats, detect differentiation opportunities, and produce a 60-day action plan calibrated to the strategic objective (lead generation / acquisition / retention / brand awareness).

LANGUAGE RULE: The report structure, labels and section titles must be in English. All analysis content, recommendations, insights and actionable items must be written in the language specified in the brand profile (profile.language). If profile.language is 'French' or 'fr', write all content in French. If 'English' or 'en', write in English.

ABSOLUTE RULE: respond ONLY with valid JSON. No text before or after. No markdown. No explanation. No \`\`\`json block. Raw JSON only.

If a data point is marked "INDISPONIBLE", ignore it and work with available data.`;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CiaModuleResults {
  messaging:  ModuleResult<ProductMessagingData> | null
  seo:        ModuleResult<SeoAcquisitionData>   | null
  social:     ModuleResult<SocialMediaData>       | null
  content:    ModuleResult<ContentAnalysisData>  | null
  benchmark:  BenchmarkData | null
  recoContext: RecommendationsContext | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function moduleSection<T>(label: string, result: ModuleResult<T> | null): string {
  if (!result || !result.data) return `${label} : INDISPONIBLE`;
  const degradedNote = result.degraded ? " (données partielles)" : "";
  return `${label}${degradedNote} :\n${JSON.stringify(result.data, null, 2)}`;
}

// ── buildConsolidatedPrompt ───────────────────────────────────────────────────

export function buildConsolidatedPrompt(
  profile: ElevayAgentProfile,
  context: CiaSessionContext,
  results: CiaModuleResults,
): string {
  // ── Contexte ──────────────────────────────────────────────────────────────
  const brandContext = `
## CONTEXTE
- Marque : ${profile.brand_name}
- URL : ${profile.brand_url}
- Pays : ${profile.country}
- LANGUAGE: ${profile.language || 'English'}
- Canaux prioritaires : ${context.priority_channels.join(", ")}
- Objectif stratégique : ${context.objective}
- Mot-clé principal : ${profile.primary_keyword}
- Mot-clé secondaire : ${profile.secondary_keyword}
- Concurrents : ${profile.competitors.map(c => `${c.name} (${c.url})`).join(", ")}
`.trim();

  // ── Données modules ───────────────────────────────────────────────────────
  const modulesSection = `
## DONNÉES DES MODULES

${moduleSection("[M1] MESSAGING PRODUIT (scraping homepage + SerpAPI pricing)", results.messaging)}

${moduleSection("[M2] SEO & ACQUISITION (DataForSEO + SerpAPI positions)", results.seo)}

${moduleSection("[M3] SOCIAL MEDIA (Apify — twitter/tiktok/instagram)", results.social)}

${moduleSection("[M4] CONTENU (SERP site: + YouTube + News)", results.content)}
`.trim();

  // ── Benchmark ─────────────────────────────────────────────────────────────
  const benchmarkSection = results.benchmark
    ? `
## BENCHMARK CONCURRENTIEL (calculé côté serveur)
${JSON.stringify(results.benchmark, null, 2)}
`.trim()
    : "## BENCHMARK CONCURRENTIEL : INDISPONIBLE";

  // ── Recommandations pré-calculées ─────────────────────────────────────────
  const recoSection = results.recoContext
    ? `
## CONTEXTE DE RECOMMANDATIONS (pré-calculé)
- Angle de repositionnement : ${results.recoContext.repositioning_angle}
- Canaux prioritaires : ${results.recoContext.priority_channels.join(", ")}
- Type de contenu à exploiter : ${results.recoContext.content_type_to_exploit}
- Menaces pré-identifiées : ${results.recoContext.threats.map(t => `[${t.urgency}] ${t.description}`).join(" | ")}
- Opportunités pré-identifiées : ${results.recoContext.opportunities.map(o => `[${o.impact}/${o.effort}] ${o.description}`).join(" | ")}
`.trim()
    : "";

  // ── Instructions ──────────────────────────────────────────────────────────
  const objectiveLabel = {
    lead_gen:    "génération de leads — exploiter les zones d'opportunité SEO et contenu pour capturer du trafic qualifié",
    acquisition: "acquisition clients — exploiter les canaux social et paid pour attirer de nouveaux clients",
    retention:   "fidélisation — combler les écarts et renforcer la relation avec les clients existants",
    branding:    "notoriété — vue équilibrée forces/faiblesses avec métriques comparatives pour renforcer la marque",
  }[context.objective];

  const instructions = `
## INSTRUCTIONS

À partir des données ci-dessus, génère UNIQUEMENT le JSON suivant (sans markdown, sans texte) :

{
  "competitor_scores": [
    // Un objet par entité analysée (marque + concurrents)
    {
      "entity": "url ou nom",
      "is_client": false,
      "seo_score": 60,
      "product_score": 55,
      "social_score": 40,
      "content_score": 70,
      "positioning_score": 56,
      "global_score": 56,
      "level": "competitive"   // vulnerable | weak | competitive | strong | dominant
    }
  ],
  "strategic_zones": [
    // Un objet par axe analysé
    {
      "axis": "seo",   // seo | product | social | content | paid | youtube
      "zone": "green", // red | saturated | neutral | green
      "description": "...",
      "directive": "..."
    }
  ],
  "threats": [
    // Max 3 menaces, urgency critique en premier
    { "description": "...", "urgency": "critical", "source": "benchmark" }
  ],
  "opportunities": [
    // Max 3 opportunités, classées par impact/effort
    { "description": "...", "effort": "low", "impact": "high", "timeframe": "< 30 jours" }
  ],
  "action_plan_60d": [
    {
      "phase": 1,
      "label": "J1-30 — Lancement",
      "objective": "...",
      "actions": ["...", "...", "..."]
    },
    {
      "phase": 2,
      "label": "J31-60 — Consolidation",
      "objective": "...",
      "actions": ["...", "...", "..."]
    }
  ]
}

Règles :
- Objectif stratégique : ${objectiveLabel}
- Les scores doivent être cohérents avec les données fournies (0-100)
- Les menaces critiques doivent être actionnables et spécifiques
- Les actions du plan doivent être concrètes et mesurables
- Réponds en ${formatLanguage(profile.language)}
- Ignore les modules marqués "INDISPONIBLE"
`.trim();

  return [brandContext, "", modulesSection, "", benchmarkSection, recoSection ? "" : "", recoSection, "", instructions]
    .filter(s => s !== undefined)
    .join("\n");
}
