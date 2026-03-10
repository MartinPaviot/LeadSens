import { z } from "zod/v4";
import { mistralClient } from "@/server/lib/llm/mistral-client";
import type { EnrichmentData, StructuredSignal } from "./summarizer";

// ─── Schema ──────────────────────────────────────────────

const icpScoreSchema = z.object({
  score: z.number().int().min(1).max(10),
  breakdown: z.object({
    jobTitleFit: z.number().int().min(1).max(10),
    companyFit: z.number().int().min(1).max(10),
    industryRelevance: z.number().int().min(1).max(10),
    locationFit: z.number().int().min(1).max(10),
  }),
  reason: z.string(),
});

export type IcpScore = z.infer<typeof icpScoreSchema>;

/** Combined score breakdown including intent + timing dimensions */
export interface CombinedScoreBreakdown {
  fitScore: number; // Original ICP fit (1-10)
  intentScore: number; // Intent signals: hiring, tech changes, engagement (1-10)
  timingScore: number; // Timing signals: funding, leadership, news (1-10)
  compoundBonus: number; // Bonus for 3+ distinct signal types (0-3)
  combinedScore: number; // Weighted: fit 40% + intent 35% + timing 25% + compound bonus
  signals: string[]; // Which signals contributed
}

interface LeadForScoring {
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  industry?: string | null;
  companySize?: string | null;
  country?: string | null;
}

// ─── System Prompt ───────────────────────────────────────

const SCORER_SYSTEM = `Tu es un moteur de scoring ICP B2B. Tu évalues si un lead correspond au profil client idéal (ICP) décrit par l'utilisateur.

Tu reçois :
1. La description ICP (ce que le client recherche — C'EST LA SEULE SOURCE DE VÉRITÉ)
2. Les données brutes du lead (de Instantly SuperSearch)

RÈGLE FONDAMENTALE : Tu scores UNIQUEMENT par rapport à l'ICP fourni. Tu n'as AUCUNE opinion personnelle sur ce qui est un "bon" ou "mauvais" lead. Si l'ICP cible des freelances, des agences, du non-profit ou des entreprises de 2 personnes — ces leads sont des 10/10.

PONDÉRATION :
- jobTitleFit (40%) : Le titre correspond-il au rôle recherché dans l'ICP ?

  CRITÈRES D'ÉVALUATION (par ordre d'importance) :

  1. POUVOIR DE DÉCISION : Le lead a-t-il le même niveau de pouvoir de décision
     que le rôle ciblé ? Un décideur stratégique (signe les budgets, définit la
     stratégie) n'est PAS interchangeable avec un exécutant opérationnel.
     → Si l'ICP cible un décideur et le lead est un exécutant : score MAX 3

  2. PÉRIMÈTRE DE RESPONSABILITÉ : Le lead a-t-il le même scope ? Quelqu'un qui
     gère un département entier n'est PAS interchangeable avec quelqu'un qui
     travaille sur un sous-domaine du même département.
     → Si le scope est fondamentalement différent : score MAX 4

  3. SYNONYMES : Les titres exacts varient entre entreprises et pays. Deux titres
     différents qui désignent le MÊME niveau de pouvoir + le MÊME périmètre = 9-10.

  4. ADJACENCE : Le N+1 ou N-1 direct dans la même fonction reste pertinent = 7-8.

  GRILLE :
  - 9-10 : Même pouvoir de décision + même périmètre (titres synonymes)
  - 7-8 : Même périmètre, adjacence directe en pouvoir de décision (N+1 ou N-1)
  - 4-6 : Même département mais pouvoir de décision OU périmètre significativement différent
  - 2-3 : Même département mais pouvoir de décision ET périmètre très différents
  - 1 : Département ou fonction sans rapport avec l'ICP

- companyFit (30%) : L'entreprise correspond-elle au profil décrit dans l'ICP ?
  - 9-10 : Taille, type et profil correspondent parfaitement à l'ICP
  - 7-8 : Correspond globalement, un critère légèrement hors cible
  - 4-6 : Un critère important ne matche pas (taille trop différente, type d'entreprise différent)
  - 1-3 : Plusieurs critères importants de l'ICP ne matchent pas

- industryRelevance (20%) : L'industrie correspond-elle à ce que l'ICP demande ?
  - 9-10 : Industrie exactement dans l'ICP
  - 7-8 : Industrie adjacente ou sous-catégorie
  - 4-6 : Industrie vaguement liée
  - 1-3 : Industrie sans rapport avec l'ICP

- locationFit (10%) : La localisation correspond-elle à l'ICP ?
  - 9-10 : Match exact (pays/ville)
  - 5-7 : Même région mais pas exactement la zone ciblée
  - 1-4 : Hors zone géographique de l'ICP
  - Si l'ICP ne mentionne PAS de localisation → 8 par défaut

CALCUL DU SCORE FINAL :
score = round(jobTitleFit × 0.4 + companyFit × 0.3 + industryRelevance × 0.2 + locationFit × 0.1)

SI UNE DONNÉE EST "(inconnu)" :
- Ne pénalise PAS le lead pour un champ manquant. Donne un score neutre (6) pour ce champ.
- Mentionne le champ manquant dans la reason.

JSON uniquement, pas de commentaires, pas de markdown.`;

// ─── Scoring Function ────────────────────────────────────

/**
 * Scores a lead against an ICP description using raw Instantly data only.
 * No scraping needed — uses Mistral Small for fast classification.
 *
 * Scoring weights: jobTitle 40%, company 30%, industry 20%, location 10%
 * Threshold: score >= 5 = qualified, < 5 = skipped
 */
export async function scoreLead(
  lead: LeadForScoring,
  icpDescription: string,
  workspaceId: string,
): Promise<IcpScore> {
  return mistralClient.json<IcpScore>({
    model: "mistral-small-latest",
    system: SCORER_SYSTEM,
    prompt: `ICP RECHERCHÉ :
${icpDescription}

LEAD À SCORER :
- Prénom: ${lead.firstName ?? "(inconnu)"}
- Nom: ${lead.lastName ?? "(inconnu)"}
- Poste: ${lead.jobTitle ?? "(inconnu)"}
- Entreprise: ${lead.company ?? "(inconnu)"}
- Industrie: ${lead.industry ?? "(inconnu)"}
- Taille entreprise: ${lead.companySize ?? "(inconnu)"}
- Pays: ${lead.country ?? "(inconnu)"}

Évalue ce lead par rapport à l'ICP. Score final = round(jobTitleFit × 0.4 + companyFit × 0.3 + industryRelevance × 0.2 + locationFit × 0.1).

JSON: {"score": N, "breakdown": {"jobTitleFit": N, "companyFit": N, "industryRelevance": N, "locationFit": N}, "reason": "1 phrase expliquant la décision"}`,
    schema: icpScoreSchema,
    workspaceId,
    action: "icp-scoring",
  });
}

// ─── Post-enrichment Signal Boost (deterministic, 0 LLM) ─

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Returns a recency multiplier for a signal based on its date.
 * <3 months = 1.0 (full weight), 3-6 months = 0.7, 6-12 months = 0.3, >12 months = 0.1
 * null/unparseable date = 0.5 (conservative default — better than stale, worse than fresh)
 */
export function signalAge(dateStr: string | null | undefined, now?: Date): number {
  if (!dateStr) return 0.5;
  const ref = now ?? new Date();
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return 0.5;
  const monthsAgo = (ref.getFullYear() - parsed.getFullYear()) * 12 + (ref.getMonth() - parsed.getMonth());
  if (monthsAgo < 3) return 1.0;
  if (monthsAgo < 6) return 0.7;
  if (monthsAgo < 12) return 0.3;
  return 0.1;
}

/** Compute weighted signal count factoring recency */
function weightedSignalCount(signals: StructuredSignal[]): number {
  if (signals.length === 0) return 0;
  return signals.reduce((sum, s) => sum + signalAge(s.date), 0);
}

/**
 * Computes intent + timing scores from enrichment data.
 * Called after enrichment to upgrade the pre-enrichment fit-only score
 * into a multi-dimensional combined score.
 *
 * Weights (STRATEGY §7.3.3):
 *   Fit 40% (from pre-enrichment LLM scoring)
 *   Intent 35% (hiring, tech changes, LinkedIn engagement)
 *   Timing 25% (funding, leadership change, public priorities)
 *
 * Baseline = 3 (no signals). Each signal type adds points, capped at 10.
 */
export function computeSignalBoost(
  fitScore: number,
  ed: EnrichmentData | null | undefined,
): CombinedScoreBreakdown {
  if (!ed) {
    return {
      fitScore,
      intentScore: 5, // neutral when no data
      timingScore: 5,
      compoundBonus: 0,
      combinedScore: fitScore,
      signals: [],
    };
  }

  const signals: string[] = [];
  let intent = 3;
  let timing = 3;

  // ── Intent signals (hiring, tech changes, engagement) ──

  const hiringSignals = ed.hiringSignals ?? [];
  const hiringWeight = weightedSignalCount(hiringSignals);
  if (hiringSignals.length > 0) {
    // Recency-weighted: recent signals contribute full weight, stale signals contribute less
    const hiringBoost = Math.max(1, clamp(Math.round(hiringWeight * 2), 0, 4));
    intent += hiringBoost;
    signals.push(`hiring×${hiringSignals.length}`);
  }

  const techChanges = ed.techStackChanges?.length ?? 0;
  if (techChanges > 0) {
    intent += clamp(techChanges * 2, 1, 3);
    signals.push(`tech_change×${techChanges}`);
  }

  // LinkedIn activity = engagement proxy
  if ((ed.recentLinkedInPosts?.length ?? 0) > 0) {
    intent += 1;
    signals.push("linkedin_active");
  }

  // Product launches = potential buying window
  const launches = ed.productLaunches?.length ?? 0;
  if (launches > 0) {
    intent += clamp(launches, 1, 2);
    signals.push(`product_launch×${launches}`);
  }

  // ── Timing signals (funding, leadership, priorities) ──

  const fundingSignals = ed.fundingSignals ?? [];
  const fundingWeight = weightedSignalCount(fundingSignals);
  if (fundingSignals.length > 0) {
    // Recency-weighted: recent funding contributes most, stale funding contributes less
    const fundingBoost = Math.max(1, clamp(Math.round(fundingWeight * 3), 0, 5));
    timing += fundingBoost;
    signals.push(`funding×${fundingSignals.length}`);
  }

  const leadershipCount = ed.leadershipChanges?.length ?? 0;
  if (leadershipCount > 0) {
    timing += clamp(leadershipCount * 2, 2, 4);
    signals.push(`leadership×${leadershipCount}`);
  }

  const priorityCount = ed.publicPriorities?.length ?? 0;
  if (priorityCount > 0) {
    timing += clamp(priorityCount, 1, 2);
    signals.push(`priority×${priorityCount}`);
  }

  // Recent news = freshness indicator
  const newsCount = ed.recentNews?.length ?? 0;
  if (newsCount > 0) {
    timing += clamp(newsCount, 1, 2);
    signals.push(`news×${newsCount}`);
  }

  const intentScore = clamp(intent, 1, 10);
  const timingScore = clamp(timing, 1, 10);

  // Compound bonus: 3+ distinct signal types = multiplicative effect
  // Research: accounts with 3+ active signals convert at 2.4x (Prospeo/Amplemarket 2026)
  const signalTypeCount = signals.length;
  const compoundBonus = signalTypeCount >= 3 ? Math.min(signalTypeCount - 2, 3) : 0;

  const baseCombined = Math.round(fitScore * 0.4 + intentScore * 0.35 + timingScore * 0.25);
  const combinedScore = clamp(baseCombined + compoundBonus, 1, 10);

  return {
    fitScore,
    intentScore,
    timingScore,
    compoundBonus,
    combinedScore,
    signals,
  };
}
