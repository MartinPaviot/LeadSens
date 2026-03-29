import { GracefulFallback, KwScore } from '../../../core/types';
import { getKeywordData, getRankings } from '../../../core/tools/dataForSeo';
import { getSerp } from '../../../core/tools/serpApi';
import { getLowHangingFruit } from '../../../core/tools/gsc';
import {
  Kga08Inputs,
  GeoMarketScore,
  CityLandingPage,
  ActionPlan90d,
  GbpAudit,
  HreflangPlan,
} from './types';

const FALLBACKS: GracefulFallback[] = [
  {
    missingTool: 'gsc',
    fallbackBehavior: 'DataForSEO uniquement — fruits mûrs (pos. 4-15) non disponibles',
    degradedOutput: 'Plan basé sur opportunités nouvelles uniquement',
  },
  {
    missingTool: 'ahrefs',
    fallbackBehavior: 'Backlinks non disponibles — difficulté KW estimée via DataForSEO',
    degradedOutput: 'Score difficulté moins précis sur les KW compétitifs',
  },
  {
    missingTool: 'gbp',
    fallbackBehavior: 'Module GBP désactivé',
    degradedOutput: 'Audit fiche Google Business Profile non disponible',
  },
];

export async function collectLowHangingFruit(
  inputs: Kga08Inputs,
  userId: string,
): Promise<KwScore[]> {
  if (!inputs.gscConnected) return [];
  try {
    const gscKw = await getLowHangingFruit(inputs.siteUrl, userId);
    return gscKw.map((k) => ({
      keyword: k.keyword,
      score: 0,
      trafficPotential: k.impressions * 0.15,
      seoDifficulty: 30,
      businessValue: 50,
      geoRelevance: 50,
      geo: inputs.targetGeos[0] ?? 'FR',
      intent: 'informational' as const,
      targetPage: k.url,
      recommendedAction: 'update' as const,
      horizon: 'M1' as const,
    }));
  } catch {
    return [];
  }
}

export async function expandKeywords(
  inputs: Kga08Inputs,
  seedKeywords: string[],
): Promise<KwScore[]> {
  try {
    const results: KwScore[] = [];
    for (const geo of inputs.targetGeos) {
      const kwData = await getKeywordData(seedKeywords, geo);
      for (const kw of kwData) {
        const score = computeScore({
          volume: kw.volume,
          difficulty: kw.difficulty,
          intent: kw.intent,
          localVolume: kw.volume,
          nationalVolume: kw.volume * 3,
        });
        results.push({
          keyword: kw.keyword,
          score,
          trafficPotential: kw.volume * 0.15,
          seoDifficulty: kw.difficulty,
          businessValue: assessBusinessValue(kw.intent),
          geoRelevance: 60,
          geo,
          intent: mapIntent(kw.intent),
          targetPage: 'create',
          recommendedAction: 'create',
          horizon: score > 70 ? 'M1' : score > 50 ? 'M2' : 'M3',
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

export function scoreGeoMarkets(
  inputs: Kga08Inputs,
  kwScores: KwScore[],
): GeoMarketScore[] {
  return inputs.targetGeos.map((geo) => {
    const geoKws = kwScores.filter((k) => k.geo === geo);
    const avgVolume = average(geoKws.map((k) => k.trafficPotential));
    const avgDifficulty = average(geoKws.map((k) => k.seoDifficulty));
    return {
      geo,
      volume: avgVolume,
      commercialPotential: avgVolume * 0.3,
      competition: avgDifficulty,
      entryEase: 100 - avgDifficulty,
      totalScore: (avgVolume * 0.4 + (100 - avgDifficulty) * 0.6) / 2,
    };
  });
}

export function detectCityLandingPages(
  inputs: Kga08Inputs,
  kwScores: KwScore[],
): CityLandingPage[] {
  if (inputs.geoLevel !== 'city' && inputs.geoLevel !== 'regional') return [];
  const MAX_CITIES = 10;
  return kwScores
    .filter((k) => k.trafficPotential > 100 && k.seoDifficulty < 40 && k.targetPage === 'create')
    .slice(0, MAX_CITIES)
    .map((k) => ({
      city: k.geo,
      keyword: k.keyword,
      monthlyVolume: k.trafficPotential,
      keywordDifficulty: k.seoDifficulty,
      recommendedUrl: `/services/${slugify(k.keyword)}-${slugify(k.geo)}`,
      targetAgent: 'WPW-09' as const,
    }));
}

export function buildActionPlan(kwScores: KwScore[]): ActionPlan90d {
  const sorted = [...kwScores].sort((a, b) => b.score - a.score);
  return {
    month1: sorted.filter((k) => k.horizon === 'M1'),
    month2: sorted.filter((k) => k.horizon === 'M2'),
    month3: sorted.filter((k) => k.horizon === 'M3'),
  };
}

export function buildClusterMap(kwScores: KwScore[]): Record<string, KwScore[]> {
  const clusters: Record<string, KwScore[]> = {};
  for (const kw of kwScores) {
    const theme = extractTheme(kw.keyword);
    if (!clusters[theme]) clusters[theme] = [];
    clusters[theme].push(kw);
  }
  return clusters;
}

export function buildGbpAudit(gbpId: string): GbpAudit {
  // stub — real implementation calls Google Business Profile API via Composio
  return {
    profileId: gbpId,
    missingFields: ['description', 'photos', 'posts'],
    recommendations: [
      'Compléter la description avec les mots-clés locaux principaux',
      'Ajouter au moins 10 photos (intérieur, équipe, produits)',
      'Publier un post Google par semaine',
      'Répondre à toutes les questions Q&A',
    ],
  };
}

export function buildHreflangPlan(inputs: Kga08Inputs): HreflangPlan {
  if (!inputs.multiCountry || inputs.targetGeos.length <= 1) {
    return { needed: false, architecture: '', errors: [], recommendations: [] };
  }
  return {
    needed: true,
    architecture: inputs.targetGeos
      .map((g) => `<link rel="alternate" hreflang="${g.toLowerCase()}" href="/${g.toLowerCase()}/"/>`)
      .join('\n'),
    errors: [],
    recommendations: [
      'Utiliser des sous-répertoires (/fr/, /be/) plutôt que des sous-domaines',
      "Ajouter un x-default pointant vers la version principale",
      'Vérifier la réciprocité de chaque balise hreflang',
      "S'assurer que les canonical ne contredisent pas les hreflang",
    ],
  };
}

// — helpers —

function computeScore(params: {
  volume: number;
  difficulty: number;
  intent: string;
  localVolume: number;
  nationalVolume: number;
}): number {
  const trafficPotential = Math.min(params.volume * 0.15, 100) * 0.30;
  const seoDifficulty = (100 - params.difficulty) * 0.25;
  const businessValue = assessBusinessValue(params.intent) * 0.25;
  const geoRelevance =
    Math.min((params.localVolume / (params.nationalVolume || 1)) * 100, 100) * 0.20;
  return Math.round(trafficPotential + seoDifficulty + businessValue + geoRelevance);
}

function assessBusinessValue(intent: string): number {
  if (intent.includes('commercial') || intent.includes('transactional')) return 85;
  if (intent.includes('navigational')) return 60;
  return 40;
}

function mapIntent(intent: string): KwScore['intent'] {
  if (intent.includes('commercial')) return 'commercial';
  if (intent.includes('transactional')) return 'transactional';
  if (intent.includes('navigational')) return 'navigational';
  return 'informational';
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function extractTheme(keyword: string): string {
  return keyword.split(' ').slice(0, 2).join(' ');
}

export { FALLBACKS };
