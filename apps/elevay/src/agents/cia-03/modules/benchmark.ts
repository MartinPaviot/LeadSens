import type { ElevayAgentProfile, ModuleResult } from "../../_shared/types";
import { getLatestOutputByAgent } from "@/lib/agent-history";
import type {
  ProductMessagingData,
  SeoAcquisitionData,
  SocialMediaData,
  ContentAnalysisData,
  CompetitorScore,
  StrategicZone,
  RadarEntry,
  BenchmarkData,
} from "../types";

// ── Types d'entrée ────────────────────────────────────────────────────────────

export interface BenchmarkInputs {
  messaging: ModuleResult<ProductMessagingData> | null
  seo:       ModuleResult<SeoAcquisitionData>   | null
  social:    ModuleResult<SocialMediaData>       | null
  content:   ModuleResult<ContentAnalysisData>  | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function levelFromScore(score: number): CompetitorScore["level"] {
  if (score < 40)  return "vulnerable";
  if (score < 55)  return "weak";
  if (score < 70)  return "competitive";
  if (score < 85)  return "strong";
  return "dominant";
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

// ── Zones stratégiques ────────────────────────────────────────────────────────

function detectZone(
  brandScore: number,
  competitorScores: number[],
): StrategicZone["zone"] {
  if (competitorScores.length === 0) return "neutral";
  const avgComp = avg(competitorScores);
  const competitorsAbove = competitorScores.filter(s => s > brandScore).length;

  if (avgComp > 70)                    return "saturated";   // tous très présents
  if (competitorsAbove >= 2)           return "red";         // brand < 2+ concurrents
  if (Math.abs(brandScore - avgComp) <= 15) return "neutral";
  if (avgComp < 50 && brandScore >= avgComp) return "green"; // faiblement exploité
  return "neutral";
}

const ZONE_DESCRIPTIONS: Record<StrategicZone["zone"], string> = {
  red:       "Axe déficitaire — concurrents significativement plus forts",
  saturated: "Marché saturé — tous les acteurs très présents, différenciation difficile",
  neutral:   "Position équilibrée — pas d'avantage concurrentiel notable",
  green:     "Opportunité — axe faiblement exploité par les concurrents",
};

const ZONE_DIRECTIVES: Record<StrategicZone["zone"], string> = {
  red:       "Investissement prioritaire requis pour combler l'écart",
  saturated: "Chercher un angle de niche ou renoncer à cet axe",
  neutral:   "Maintenir et améliorer progressivement",
  green:     "Prendre la tête rapidement avec du contenu ciblé et des actions concrètes",
};

// ── Module principal (zéro appel API) ─────────────────────────────────────────

export async function runBenchmark(
  profile: ElevayAgentProfile,
  inputs: BenchmarkInputs,
  workspaceId?: string,
): Promise<BenchmarkData> {
  // ── Scores par concurrent ──────────────────────────────────────────────────

  const competitorUrls = profile.competitors.map(c => c.url);

  const scores: CompetitorScore[] = competitorUrls.map(url => {
    // SEO score
    const seoScore = inputs.seo?.data?.competitors_seo.find(s => s.entity_url === url)?.seo_score ?? 0;

    // Product score = moyenne clarity + differentiation
    const messaging = inputs.messaging?.data?.competitors.find(m => m.competitor_url === url);
    const productScore = messaging
      ? Math.round((messaging.messaging_clarity_score + messaging.differentiation_score) / 2)
      : 0;

    // Social score
    const socialScore = inputs.social?.data?.competitors.find(s => s.competitor_url === url)?.social_score ?? 0;

    // Content score
    const contentScore = inputs.content?.data?.competitors.find(c => c.competitor_url === url)?.content_score ?? 0;

    const positioning_score = avg([seoScore, productScore, socialScore, contentScore]);
    const global_score       = avg([seoScore, productScore, socialScore, contentScore]);

    return {
      entity:            url,
      is_client:         false,
      seo_score:         seoScore,
      product_score:     productScore,
      social_score:      socialScore,
      content_score:     contentScore,
      positioning_score,
      global_score,
      level:             levelFromScore(global_score),
    };
  });

  // ── Score de la marque cliente ─────────────────────────────────────────────

  const brandSeoScore     = inputs.seo?.data?.brand_seo.seo_score ?? 0;
  const brandProductScore = 50; // pas de self-messaging — neutre par défaut

  // Fetch real brand social score from latest BPI-01 run if available
  let brandSocialScore = 0;
  if (workspaceId) {
    try {
      const lastBpi = await getLatestOutputByAgent(workspaceId, 'BPI-01');
      const bpiPayload = lastBpi?.payload as { scores?: { social?: number } } | undefined;
      brandSocialScore = bpiPayload?.scores?.social ?? 0;
    } catch {
      // best-effort — keep 0
    }
  }

  const brandContentScore = 0;

  scores.unshift({
    entity:            profile.brand_url,
    is_client:         true,
    seo_score:         brandSeoScore,
    product_score:     brandProductScore,
    social_score:      brandSocialScore,
    content_score:     brandContentScore,
    positioning_score: avg([brandSeoScore, brandProductScore, brandSocialScore, brandContentScore]),
    global_score:      avg([brandSeoScore, brandProductScore, brandSocialScore, brandContentScore]),
    level:             levelFromScore(avg([brandSeoScore, brandProductScore])),
  });

  // ── Zones stratégiques ─────────────────────────────────────────────────────

  const brandEntry = scores[0];
  const competitorEntries = scores.slice(1);

  const axes: StrategicZone["axis"][] = ["seo", "product", "social", "content"];
  const axisKey: Record<StrategicZone["axis"], keyof CompetitorScore> = {
    seo:     "seo_score",
    product: "product_score",
    social:  "social_score",
    content: "content_score",
    paid:    "seo_score",     // proxy si pas de données paid
    youtube: "content_score", // proxy
  };

  const strategic_zones: StrategicZone[] = axes.map(axis => {
    const key = axisKey[axis];
    const brandScore = brandEntry[key] as number;
    const compScores = competitorEntries.map(e => e[key] as number);
    const zone = detectZone(brandScore, compScores);
    return {
      axis,
      zone,
      description: ZONE_DESCRIPTIONS[zone],
      directive:   ZONE_DIRECTIVES[zone],
    };
  });

  // ── Radar data ─────────────────────────────────────────────────────────────

  const radar_data: RadarEntry[] = scores.map(s => ({
    entity:      s.entity,
    seo:         s.seo_score,
    product:     s.product_score,
    social:      s.social_score,
    content:     s.content_score,
    positioning: s.positioning_score,
  }));

  return { competitor_scores: scores, strategic_zones, radar_data };
}

// ── Export wrappé en ModuleResult (pour la route) ─────────────────────────────

export async function fetchBenchmark(
  profile: ElevayAgentProfile,
  inputs: BenchmarkInputs,
  workspaceId?: string,
): Promise<ModuleResult<BenchmarkData>> {
  try {
    const data = await runBenchmark(profile, inputs, workspaceId);
    return { success: true, data, source: "benchmark:pure-calc" };
  } catch (err) {
    return {
      success: false,
      data:    null,
      source:  "benchmark:pure-calc",
      error: {
        code:    "BENCHMARK_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
