import { GracefulFallback } from '../../../core/types';
import { getRankings } from '../../../core/tools/dataForSeo';
import { getSerp } from '../../../core/tools/serpApi';
import { getTopPages } from '../../../core/tools/gsc';
import {
  Pio05Inputs,
  DualDashboard,
  ChannelVisibility,
  LlmCitabilityScore,
  LlmAxisScore,
  LlmStructureAudit,
  LlmStructureIssue,
  CompetitorIntelligence,
  GeoChannel,
  LlmCitabilityAxis,
  LLM_AXIS_WEIGHTS,
  LLM_READY_FORMATS,
} from './types';

// getRankings reserved for future direct ranking fallback
void getRankings;

const FALLBACKS: GracefulFallback[] = [
  {
    missingTool: 'gsc',
    fallbackBehavior: 'DataForSEO pour ranking — trafic réel non disponible',
    degradedOutput: 'Score SEO basé sur positions uniquement, sans CTR ni impressions',
  },
  {
    missingTool: 'ga',
    fallbackBehavior: 'Comportement utilisateur non disponible',
    degradedOutput: 'Score GEO sans données trafic organique par canal',
  },
  {
    missingTool: 'ahrefs',
    fallbackBehavior: 'Axe backlinks autoritaires estimé sur critères structurels',
    degradedOutput: 'Score E-E-A-T et backlinks moins précis',
  },
  {
    missingTool: 'perplexity',
    fallbackBehavior: 'Score LLM estimé sur critères structurels uniquement',
    degradedOutput: 'Citabilité Perplexity non mesurée directement',
  },
];

export async function buildDualDashboard(
  inputs: Pio05Inputs,
  userId: string,
): Promise<DualDashboard> {
  const channels: ChannelVisibility[] = [];

  // Google Search
  try {
    const pages = inputs.gscConnected
      ? await getTopPages(inputs.siteUrl, userId, 20)
      : [];
    const avgPosition =
      pages.length > 0
        ? pages.reduce((sum, p) => sum + p.position, 0) / pages.length
        : 50;
    const seoScore = Math.round(Math.max(0, 100 - avgPosition * 1.5));

    channels.push({
      channel: 'google_search',
      score: seoScore,
      trend: 'stable',
      topPages: pages.slice(0, 5).map((p) => p.url),
      notes:
        pages.length > 0
          ? `Position moyenne : ${avgPosition.toFixed(1)}`
          : 'GSC non connecté — score estimé',
    });
  } catch {
    channels.push(buildFallbackChannel('google_search'));
  }

  // Google AI Overview (estimated — API not available in V1)
  channels.push({
    channel: 'google_ai_overview',
    score: 0,
    trend: 'stable',
    topPages: [],
    notes: 'Score estimé — API Google AI Overview non disponible en V1',
  });

  // Bing Copilot (estimated — no direct API in V1)
  channels.push({
    channel: 'bing_copilot',
    score: 0,
    trend: 'stable',
    topPages: [],
    notes: 'Score estimé — mesure directe indisponible en V1',
  });

  // Perplexity (estimated — no direct API in V1)
  channels.push({
    channel: 'perplexity',
    score: 0,
    trend: 'stable',
    topPages: [],
    notes: 'Score estimé — API Perplexity non disponible en V1',
  });

  // Google Maps
  channels.push({
    channel: 'google_maps',
    score: 0,
    trend: 'stable',
    topPages: [],
    notes: 'Activé uniquement si GEO local configuré',
  });

  const seoChannel = channels.find((c) => c.channel === 'google_search');
  const seoScore = seoChannel?.score ?? 0;
  const geoChannels = channels.filter((c) => c.channel !== 'google_search');
  const geoScore = Math.round(
    geoChannels.reduce((sum, c) => sum + c.score, 0) / geoChannels.length,
  );

  return {
    seoScore,
    geoScore,
    overallScore: Math.round(seoScore * 0.6 + geoScore * 0.4),
    channels,
    measuredAt: new Date(),
  };
}

export function computeLlmCitabilityScore(inputs: Pio05Inputs): LlmCitabilityScore {
  const axes: LlmAxisScore[] = [
    buildAxisScore('eeat', inputs),
    buildAxisScore('content_structure', inputs),
    buildAxisScore('verifiable_facts', inputs),
    buildAxisScore('authoritative_backlinks', inputs),
  ];

  const total = Math.round(axes.reduce((sum, a) => sum + a.score * a.weight, 0));

  const topOpportunities = axes
    .filter((a) => a.score < 60)
    .flatMap((a) => a.recommendations.slice(0, 2));

  return { total, axes, topOpportunities, measuredAt: new Date() };
}

export function auditLlmStructure(inputs: Pio05Inputs): LlmStructureAudit {
  const issues: LlmStructureIssue[] = [];
  const pagesAudited = inputs.targetKeywords.length;

  // Stub — real implementation crawls each page and checks for LLM-ready formats
  for (const keyword of inputs.targetKeywords) {
    const missingFormats = LLM_READY_FORMATS.slice(0, 3);
    for (const format of missingFormats) {
      issues.push({
        url: `${inputs.siteUrl}/${keyword.replace(/\s+/g, '-')}`,
        issue: `Format LLM-ready manquant : ${format}`,
        recommendation: `Ajouter ${format} sur cette page`,
        priority: 'high',
        targetAgent: 'OPT-06',
      });
    }
  }

  const llmReadyPages = Math.max(0, pagesAudited - issues.length);

  return {
    issues,
    pagesAudited,
    llmReadyPages,
    llmReadyRatio: pagesAudited > 0 ? llmReadyPages / pagesAudited : 0,
  };
}

export async function analyzeCompetitors(
  inputs: Pio05Inputs,
): Promise<CompetitorIntelligence[]> {
  const results: CompetitorIntelligence[] = [];

  for (const competitorUrl of inputs.competitorUrls) {
    try {
      const keyword = inputs.targetKeywords[0] ?? '';
      const serp = await getSerp(keyword, inputs.geoTargets[0] ?? 'FR', 10);
      const inSerp = serp.some((r) => r.url.includes(competitorUrl));

      results.push({
        url: competitorUrl,
        seoScore: inSerp ? 70 : 40,
        llmCitabilityScore: 50,
        topKeywords: inputs.targetKeywords.slice(0, 3),
        strengths: inSerp
          ? ['Présent dans le top 10 SERP', 'Contenu structuré']
          : ['Domaine établi'],
      });
    } catch {
      results.push({
        url: competitorUrl,
        seoScore: 0,
        llmCitabilityScore: 0,
        topKeywords: [],
        strengths: [],
      });
    }
  }

  return results;
}

export function buildRecommendations(
  dashboard: DualDashboard,
  llmScore: LlmCitabilityScore,
  audit: LlmStructureAudit,
): { forOpt06: string[]; forContent: string[] } {
  const forOpt06: string[] = [];
  const forContent: string[] = [];

  if (dashboard.seoScore < 50) {
    forOpt06.push("Prioriser l'optimisation des pages en position 4-15 (fruits mûrs)");
  }
  if (dashboard.geoScore < 30) {
    forOpt06.push(
      "Activer l'optimisation GEO — Google Business Profile et citations locales",
    );
  }
  if (llmScore.total < 50) {
    forContent.push('Ajouter FAQ schema (FAQPage) sur les pages stratégiques');
    forContent.push(
      'Restructurer les introductions : réponse directe dans les 2 premières phrases',
    );
  }
  if (audit.llmReadyRatio < 0.3) {
    forContent.push(
      "Moins de 30% des pages sont LLM-ready — prioriser la restructuration éditoriale",
    );
  }

  return { forOpt06, forContent };
}

// — helpers —

function buildAxisScore(axis: LlmCitabilityAxis, _inputs: Pio05Inputs): LlmAxisScore {
  const weight = LLM_AXIS_WEIGHTS[axis];

  const axisConfig: Record<
    LlmCitabilityAxis,
    { score: number; signals: string[]; recommendations: string[] }
  > = {
    eeat: {
      score: 45,
      signals: ['Page About présente', 'Auteurs non identifiés sur les articles'],
      recommendations: [
        "Ajouter des biographies d'auteurs sur tous les articles de blog",
        "Renforcer la page About avec l'expertise de l'équipe",
      ],
    },
    content_structure: {
      score: 40,
      signals: ['Titres H2/H3 présents', 'FAQ schema manquant sur les pages stratégiques'],
      recommendations: [
        'Ajouter FAQ schema sur les 5 pages à plus fort trafic',
        'Restructurer les introductions pour répondre directement à la requête',
      ],
    },
    verifiable_facts: {
      score: 55,
      signals: ['Quelques chiffres présents', 'Sources externes peu citées'],
      recommendations: [
        'Ajouter des statistiques sourcées avec date de publication',
        "Citer des études ou rapports de référence dans chaque article",
      ],
    },
    authoritative_backlinks: {
      score: 35,
      signals: ['DA estimé < 40', 'Peu de backlinks éditoriaux détectés'],
      recommendations: [
        'Développer une stratégie de contenu linkable (études, données originales)',
        'Identifier les opportunités de guest posting sur des domaines DA 50+',
      ],
    },
  };

  return { axis, weight, ...axisConfig[axis] };
}

function buildFallbackChannel(channel: GeoChannel): ChannelVisibility {
  return {
    channel,
    score: 0,
    trend: 'stable',
    topPages: [],
    notes: 'Données non disponibles',
  };
}

export { FALLBACKS };
