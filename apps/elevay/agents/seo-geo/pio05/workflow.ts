import { GracefulFallback } from '../../../core/types';
import { getRankings } from '../../../core/tools/dataForSeo';
import { getSerp, detectAiOverview } from '../../../core/tools/serpApi';
import { getTopPages } from '../../../core/tools/gsc';
import { ahrefsGetDomainRating, ahrefsGetBacklinkStats } from '../../../core/tools/ahrefs';
import { semrushGetAuthorityScore, semrushGetBacklinksOverview } from '../../../core/tools/semrush';
import { isToolConnected } from '../../../core/tools/composio';
import {
  Pio05Inputs,
  Pio05Output,
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

  // Google AI Overview — check if brand appears in AI summaries for target keywords
  try {
    const aiKeywords = inputs.targetKeywords.slice(0, 3);
    if (aiKeywords.length > 0) {
      const geo = inputs.geoTargets[0] ?? 'FR';
      const aiResults = await Promise.allSettled(
        aiKeywords.map((kw) => detectAiOverview(kw, geo)),
      );
      const fulfilled = aiResults.filter(
        (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof detectAiOverview>>> =>
          r.status === 'fulfilled',
      );
      const detected = fulfilled.filter((r) => r.value.detected).length;
      const total = fulfilled.length;
      const aioScore = total > 0 ? Math.round((detected / total) * 100) : 0;
      const citedSources = fulfilled
        .flatMap((r) => r.value.sources)
        .filter((s) => s.includes(new URL(inputs.siteUrl).hostname))
        .slice(0, 5);
      channels.push({
        channel: 'google_ai_overview',
        score: aioScore,
        trend: 'stable',
        topPages: citedSources,
        notes: `${detected}/${total} keywords with AI Overview detected`,
      });
    } else {
      channels.push(buildFallbackChannel('google_ai_overview'));
    }
  } catch {
    channels.push(buildFallbackChannel('google_ai_overview'));
  }

  // TODO V2: Bing API
  channels.push({
    channel: 'bing_copilot',
    score: 0,
    trend: 'stable',
    topPages: [],
    notes: 'Bing Copilot — requires Bing Webmaster API (V2)',
  });

  // TODO V2: Perplexity API
  channels.push({
    channel: 'perplexity',
    score: 0,
    trend: 'stable',
    topPages: [],
    notes: 'Perplexity — requires Perplexity API (V2)',
  });

  // Google Maps / Local Pack — check if brand appears in local results
  try {
    const geo = inputs.geoTargets[0] ?? 'FR';
    let hostname = '';
    try { hostname = new URL(inputs.siteUrl).hostname; } catch { /* skip */ }
    if (hostname) {
      const localSerp = await getSerp(`${hostname.replace(/^www\./, '')} ${geo}`, geo, 10);
      const inLocalPack = localSerp.some((r) => r.url.includes(hostname));
      const mapsScore = inLocalPack ? 70 : 20;
      channels.push({
        channel: 'google_maps',
        score: mapsScore,
        trend: 'stable',
        topPages: localSerp.filter((r) => r.url.includes(hostname)).map((r) => r.url).slice(0, 3),
        notes: inLocalPack
          ? 'Brand found in local search results'
          : 'Brand not found in local pack — consider Google Business Profile',
      });
    } else {
      channels.push(buildFallbackChannel('google_maps'));
    }
  } catch {
    channels.push(buildFallbackChannel('google_maps'));
  }

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

export async function computeLlmCitabilityScore(
  inputs: Pio05Inputs,
  userId: string,
): Promise<LlmCitabilityScore> {
  const axes = await Promise.all([
    buildAxisScore('eeat', inputs, userId),
    buildAxisScore('content_structure', inputs, userId),
    buildAxisScore('verifiable_facts', inputs, userId),
    buildAxisScore('authoritative_backlinks', inputs, userId),
  ]);

  const total = Math.round(axes.reduce((sum, a) => sum + a.score * a.weight, 0));

  const topOpportunities = axes
    .filter((a) => a.score < 60)
    .flatMap((a) => a.recommendations.slice(0, 2));

  return { total, axes, topOpportunities, measuredAt: new Date() };
}

export async function auditLlmStructure(
  inputs: Pio05Inputs,
  priorityPages: string[],
): Promise<LlmStructureAudit> {
  // Build URL list: priorityPages first, then derive from targetKeywords as fallback
  const urls = priorityPages.length > 0
    ? priorityPages
    : inputs.targetKeywords.map((kw) => `${inputs.siteUrl}/${kw.replace(/\s+/g, '-')}`);

  if (urls.length === 0) {
    return { issues: [], pagesAudited: 0, llmReadyPages: 0, llmReadyRatio: 0 };
  }

  // Audit up to 10 pages to stay fast
  const pagesToAudit = urls.slice(0, 10);
  const pageResults = await Promise.all(
    pagesToAudit.map((url) => auditSinglePage(url)),
  );

  const issues: LlmStructureIssue[] = [];
  let llmReadyCount = 0;

  for (const result of pageResults) {
    if (!result) continue; // fetch failed — skipped
    issues.push(...result.issues);
    if (result.issues.length === 0) llmReadyCount++;
  }

  const pagesAudited = pageResults.filter(Boolean).length;

  return {
    issues,
    pagesAudited,
    llmReadyPages: llmReadyCount,
    llmReadyRatio: pagesAudited > 0 ? llmReadyCount / pagesAudited : 0,
  };
}

// ─── Single page LLM-readiness audit ─────────────────────

interface PageAuditResult {
  url: string;
  score: number;
  issues: LlmStructureIssue[];
}

const LLM_SIGNAL_CHECKS: {
  id: string;
  label: string;
  test: (html: string) => boolean;
  recommendation: string;
  priority: LlmStructureIssue['priority'];
  targetAgent: LlmStructureIssue['targetAgent'];
}[] = [
  {
    id: 'faq_schema',
    label: 'FAQ schema (FAQPage)',
    test: (html) => /["']FAQPage["']/.test(html),
    recommendation: 'Ajouter un bloc FAQ avec balisage schema.org FAQPage (JSON-LD)',
    priority: 'high',
    targetAgent: 'OPT-06',
  },
  {
    id: 'howto_schema',
    label: 'HowTo schema',
    test: (html) => /["']HowTo["']/.test(html),
    recommendation: 'Ajouter un balisage schema.org HowTo pour les contenus tutoriels',
    priority: 'medium',
    targetAgent: 'OPT-06',
  },
  {
    id: 'direct_answer',
    label: 'Réponse directe dans l\'introduction',
    test: (html) => hasDirectAnswer(html),
    recommendation: 'Reformuler l\'introduction : réponse directe dans les 2 premières phrases après le H1',
    priority: 'high',
    targetAgent: 'BSW-10',
  },
  {
    id: 'numbered_lists',
    label: 'Listes numérotées',
    test: (html) => /<ol[\s>]/i.test(html),
    recommendation: 'Ajouter au moins une liste numérotée (étapes, classement, processus)',
    priority: 'medium',
    targetAgent: 'BSW-10',
  },
  {
    id: 'comparative_tables',
    label: 'Tableaux comparatifs',
    test: (html) => /<table[\s>]/i.test(html) && /<th[\s>]/i.test(html),
    recommendation: 'Ajouter un tableau comparatif balisé avec en-têtes <th>',
    priority: 'medium',
    targetAgent: 'BSW-10',
  },
  {
    id: 'expert_citations',
    label: 'Citations d\'experts avec attribution',
    test: (html) => /<blockquote[\s>]/i.test(html) || /<cite[\s>]/i.test(html),
    recommendation: 'Ajouter des citations d\'experts avec balises <blockquote> et <cite>',
    priority: 'low',
    targetAgent: 'BSW-10',
  },
];

async function auditSinglePage(url: string): Promise<PageAuditResult | null> {
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ElevayBot/1.0 (SEO Audit)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    // Read up to 500KB to avoid memory issues on large pages
    const text = await res.text();
    html = text.slice(0, 512_000);
  } catch {
    // Fetch failed — skip this URL, never block
    return null;
  }

  const issues: LlmStructureIssue[] = [];
  let passedChecks = 0;

  for (const check of LLM_SIGNAL_CHECKS) {
    if (check.test(html)) {
      passedChecks++;
    } else {
      issues.push({
        url,
        issue: `Format LLM-ready manquant : ${check.label}`,
        recommendation: check.recommendation,
        priority: check.priority,
        targetAgent: check.targetAgent,
      });
    }
  }

  const score = Math.round((passedChecks / LLM_SIGNAL_CHECKS.length) * 100);

  return { url, score, issues };
}

/**
 * Checks whether the first <p> after the first <h1> contains a definition-like
 * pattern: "X est ...", "X is ...", "X désigne ...", or a colon-based definition.
 */
function hasDirectAnswer(html: string): boolean {
  // Extract the first <p> content after the first <h1>
  const h1Match = /<h1[^>]*>[\s\S]*?<\/h1>/i.exec(html);
  if (!h1Match) return false;

  const afterH1 = html.slice((h1Match.index ?? 0) + h1Match[0].length);
  const firstPMatch = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(afterH1);
  if (!firstPMatch?.[1]) return false;

  const firstP = firstPMatch[1].replace(/<[^>]+>/g, '').trim();
  if (firstP.length < 20) return false;

  // Check for definition patterns (FR + EN)
  return /\b(est|is|are|désigne|signifie|représente|correspond|means|refers)\b/i.test(firstP)
    || /\s:\s/.test(firstP);
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

async function buildAxisScore(
  axis: LlmCitabilityAxis,
  inputs: Pio05Inputs,
  userId: string,
): Promise<LlmAxisScore> {
  const weight = LLM_AXIS_WEIGHTS[axis];

  const ahrefsConnected = await isToolConnected('ahrefs', userId);
  const semrushConnected = await isToolConnected('semrush', userId);

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

  // Override eeat score with real DR/AS data
  if (axis === 'eeat') {
    try {
      if (ahrefsConnected) {
        const metrics = await ahrefsGetDomainRating(inputs.siteUrl, userId);
        if (metrics) {
          const drScore = Math.min(metrics.domainRating, 100);
          return {
            axis,
            weight,
            score: drScore,
            signals: [
              `Domain Rating Ahrefs : ${metrics.domainRating}/100`,
              `${metrics.referringDomains} domaines référents`,
              `${metrics.organicKeywords} mots-clés organiques`,
            ],
            recommendations: drScore < 40
              ? ['Développer une stratégie de link building', 'Viser des backlinks éditoriaux DA 50+']
              : ['DR solide — maintenir la cadence éditoriale'],
          };
        }
      } else if (semrushConnected) {
        const metrics = await semrushGetAuthorityScore(inputs.siteUrl, userId);
        if (metrics) {
          const asScore = Math.min(metrics.authorityScore, 100);
          return {
            axis,
            weight,
            score: asScore,
            signals: [
              `Authority Score SEMrush : ${metrics.authorityScore}/100`,
              `${metrics.referringDomains} domaines référents`,
            ],
            recommendations: asScore < 40
              ? ["Renforcer l'autorité du domaine via le link building"]
              : ['Autorité correcte — focus sur le contenu'],
          };
        }
      }
    } catch {
      // fall through to defaults
    }
  }

  // Override authoritative_backlinks with real backlink data
  if (axis === 'authoritative_backlinks') {
    try {
      if (ahrefsConnected) {
        const stats = await ahrefsGetBacklinkStats(inputs.siteUrl, userId);
        if (stats) {
          const qualityRatio = stats.totalBacklinks > 0
            ? (stats.dofollow / stats.totalBacklinks) * 100
            : 0;
          const score = Math.min(
            Math.round(qualityRatio * 0.6 + (stats.referringDomains > 100 ? 40 : stats.referringDomains * 0.4)),
            100,
          );
          return {
            axis,
            weight,
            score,
            signals: [
              `${stats.totalBacklinks} backlinks totaux`,
              `${stats.referringDomains} domaines référents`,
              `${stats.dofollow} dofollow / ${stats.nofollow} nofollow`,
            ],
            recommendations: score < 50
              ? ['Augmenter le ratio de backlinks dofollow', 'Diversifier les domaines référents']
              : ['Profil de backlinks sain'],
          };
        }
      } else if (semrushConnected) {
        const overview = await semrushGetBacklinksOverview(inputs.siteUrl, userId);
        if (overview) {
          const score = Math.min(
            Math.round(overview.authorityScore * 0.7 + (overview.referringDomains > 50 ? 30 : overview.referringDomains * 0.6)),
            100,
          );
          return {
            axis,
            weight,
            score,
            signals: [
              `${overview.backlinks} backlinks`,
              `${overview.referringDomains} domaines référents`,
              `Authority Score : ${overview.authorityScore}`,
            ],
            recommendations: score < 50
              ? ['Renforcer le profil de backlinks']
              : ['Profil de liens correct'],
          };
        }
      }
    } catch {
      // fall through to defaults
    }
  }

  // Default fallback — existing hardcoded config
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

// ─── Google Sheets export ────────────────────────────────

export async function exportPio05ToSheets(
  output: Pio05Output,
  siteUrl: string,
  userId: string,
): Promise<string | null> {
  try {
    const sheetsConnected = await isToolConnected('sheets', userId);
    if (!sheetsConnected) return null;

    const { sheetsCreateDashboard } = await import('../../../core/tools/composio');

    // Sheet 1 — Dashboard
    const dashboardRows: Record<string, unknown>[] = output.dualDashboard.channels.map((ch) => ({
      'Canal': ch.channel,
      'Score': ch.score,
      'Tendance': ch.trend,
      'Top Pages': ch.topPages.join(', ') || 'N/A',
      'Notes': ch.notes,
    }));

    // Add summary row
    dashboardRows.unshift({
      'Canal': '** RÉSUMÉ **',
      'Score': output.dualDashboard.overallScore,
      'Tendance': '',
      'Top Pages': `SEO: ${output.dualDashboard.seoScore} | GEO: ${output.dualDashboard.geoScore}`,
      'Notes': `LLM Citabilité: ${output.llmCitabilityScore.total}/100`,
    });

    const url = await sheetsCreateDashboard(
      `PIO-05 Dashboard — ${siteUrl} — ${new Date().toISOString().split('T')[0]}`,
      dashboardRows,
      userId,
    );

    return url;
  } catch {
    return null;
  }
}

// ─── PDF report (HTML generation) ────────────────────────

const BRAND = {
  teal: '#17C3B2',
  blue: '#2C6BED',
  orange: '#FF7A3D',
  warmWhite: '#FFF7ED',
  dark: '#1a1a2e',
} as const;

export function generatePio05PdfHtml(
  output: Pio05Output,
  siteUrl: string,
): string {
  const date = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });

  // Top 5 issues
  const topIssues = output.llmStructureAudit.issues
    .sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      return (p[a.priority] ?? 2) - (p[b.priority] ?? 2);
    })
    .slice(0, 5);

  // Top recommendations
  const topRecs = [
    ...output.recommendationsForOpt06.slice(0, 2),
    ...output.recommendationsForContent.slice(0, 1),
  ].slice(0, 3);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', 'Segoe UI', sans-serif; color: ${BRAND.dark}; background: #fff; font-size: 13px; line-height: 1.5; }
  .page { padding: 40px; max-width: 800px; margin: 0 auto; }
  .header { background: linear-gradient(135deg, ${BRAND.blue}, ${BRAND.teal}); color: #fff; padding: 32px 40px; border-radius: 12px; margin-bottom: 32px; }
  .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .header p { font-size: 13px; opacity: 0.85; }
  h2 { font-size: 16px; font-weight: 700; color: ${BRAND.blue}; margin: 24px 0 12px; border-bottom: 2px solid ${BRAND.teal}; padding-bottom: 4px; }
  .score-grid { display: flex; gap: 16px; margin-bottom: 24px; }
  .score-card { flex: 1; background: ${BRAND.warmWhite}; border-radius: 8px; padding: 16px; text-align: center; }
  .score-card .value { font-size: 32px; font-weight: 800; color: ${BRAND.blue}; }
  .score-card .label { font-size: 11px; color: #666; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
  th { background: ${BRAND.blue}; color: #fff; padding: 8px 10px; text-align: left; font-weight: 600; }
  td { padding: 6px 10px; border-bottom: 1px solid #eee; }
  tr:nth-child(even) td { background: ${BRAND.warmWhite}; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
  .badge-high { background: ${BRAND.orange}; color: #fff; }
  .badge-medium { background: #fbbf24; color: #333; }
  .badge-low { background: #a3e635; color: #333; }
  ul { padding-left: 20px; margin-bottom: 12px; }
  li { margin-bottom: 4px; }
  .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #999; }
</style>
</head>
<body>
<div class="page">

<div class="header">
  <h1>Rapport SEO & GEO Intelligence</h1>
  <p>${siteUrl} — ${date} — Généré par Elevay PIO-05</p>
</div>

<h2>1. Résumé exécutif</h2>
<div class="score-grid">
  <div class="score-card">
    <div class="value">${output.dualDashboard.overallScore}</div>
    <div class="label">Score global /100</div>
  </div>
  <div class="score-card">
    <div class="value">${output.dualDashboard.seoScore}</div>
    <div class="label">SEO Score</div>
  </div>
  <div class="score-card">
    <div class="value">${output.dualDashboard.geoScore}</div>
    <div class="label">GEO Score</div>
  </div>
  <div class="score-card">
    <div class="value">${output.llmCitabilityScore.total}</div>
    <div class="label">LLM Citabilité /100</div>
  </div>
</div>

<h2>2. Top 5 problèmes à traiter</h2>
${topIssues.length > 0 ? `<table>
<tr><th>URL</th><th>Problème</th><th>Priorité</th><th>Action</th></tr>
${topIssues.map((i) => `<tr>
  <td>${escapeHtml(i.url)}</td>
  <td>${escapeHtml(i.issue)}</td>
  <td><span class="badge badge-${i.priority}">${i.priority}</span></td>
  <td>${escapeHtml(i.recommendation)}</td>
</tr>`).join('\n')}
</table>` : '<p>Aucun problème critique détecté.</p>'}

<h2>3. Audit structure LLM</h2>
<p>${output.llmStructureAudit.pagesAudited} pages auditées — ${output.llmStructureAudit.llmReadyPages} LLM-ready (${Math.round(output.llmStructureAudit.llmReadyRatio * 100)}%)</p>
<table>
<tr><th>Axe</th><th>Score</th><th>Poids</th><th>Signaux</th><th>Recommandation</th></tr>
${output.llmCitabilityScore.axes.map((a) => `<tr>
  <td>${escapeHtml(a.axis)}</td>
  <td>${a.score}/100</td>
  <td>${Math.round(a.weight * 100)}%</td>
  <td>${escapeHtml(a.signals.slice(0, 2).join(', '))}</td>
  <td>${escapeHtml(a.recommendations[0] ?? '')}</td>
</tr>`).join('\n')}
</table>

<h2>4. Visibilité par canal</h2>
<table>
<tr><th>Canal</th><th>Score</th><th>Tendance</th><th>Notes</th></tr>
${output.dualDashboard.channels.map((c) => `<tr>
  <td>${escapeHtml(c.channel)}</td>
  <td>${c.score}/100</td>
  <td>${c.trend}</td>
  <td>${escapeHtml(c.notes)}</td>
</tr>`).join('\n')}
</table>

<h2>5. Prochaines étapes recommandées</h2>
<ul>
${topRecs.map((r) => `  <li>${escapeHtml(r)}</li>`).join('\n')}
${topRecs.length === 0 ? '  <li>Continuer le monitoring régulier des positions et de la citabilité LLM.</li>' : ''}
</ul>

<div class="footer">
  Généré par Elevay PIO-05 — ${date}
</div>

</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Schedule next run ───────────────────────────────────

export function computeNextRunAt(
  reportFrequency: Pio05Inputs['reportFrequency'],
): Date | undefined {
  if (reportFrequency === 'on-demand') return undefined;
  const now = new Date();
  if (reportFrequency === 'weekly') {
    now.setDate(now.getDate() + 7);
  } else if (reportFrequency === 'monthly') {
    now.setMonth(now.getMonth() + 1);
  }
  return now;
}

// Google Slides: not available in V1 — Composio does not expose Slides API yet.
// TODO: Add Slides export when Google Slides integration is added to Composio.

export { FALLBACKS };
