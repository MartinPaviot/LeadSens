import { GracefulFallback, CmsCorrection } from '../../../core/types';
import { getRankings } from '../../../core/tools/dataForSeo';
import { getSerp } from '../../../core/tools/serpApi';
import { getTopPages, getLowHangingFruit } from '../../../core/tools/gsc';
import { ahrefsGetOrganicKeywords } from '../../../core/tools/ahrefs';
import { semrushGetDomainKeywords } from '../../../core/tools/semrush';
import { isToolConnected } from '../../../core/tools/composio';
import {
  wpGetPages,
  wpGetPosts,
  wpUpdateMeta,
  type WordPressCredentials,
  type WordPressPage,
} from '../../../core/tools/cms/wordpress';
import {
  hubGetPageMap,
  hubUpdateMeta,
  type HubSpotCredentials,
} from '../../../core/tools/cms/hubspot';
import {
  shopifyGetPageMap,
  shopifyUpdateMeta,
  type ShopifyCredentials,
} from '../../../core/tools/cms/shopify';
import {
  webflowGetSiteMap,
  webflowUpdatePageMeta,
  webflowUpdateCollectionItemMeta,
  type WebflowCredentials,
} from '../../../core/tools/cms/webflow';
import {
  Opt06Inputs,
  PageRanking,
  OptimizationOpportunity,
  OptimizationTarget,
  OptimizationLog,
  MonitoringAlert,
  CorrectionPushResult,
  HIGH_TRAFFIC_THRESHOLD,
  LOW_HANGING_POSITION_RANGE,
  ALERT_POSITION_DROP_THRESHOLD,
} from './types';

// suppress unused-import lint for stubs pending real implementation
void getSerp;
void getLowHangingFruit;

const FALLBACKS: GracefulFallback[] = [
  {
    missingTool: 'gsc',
    fallbackBehavior: 'DataForSEO rankings uniquement — trafic réel non disponible',
    degradedOutput: 'Priorisation par position seule, sans données trafic',
  },
  {
    missingTool: 'ga',
    fallbackBehavior: 'Seuil 1000 visites/mois non applicable — validation humaine élargie',
    degradedOutput: 'Toutes les pages > DA 30 passent en validation humaine',
  },
  {
    missingTool: 'dataForSeo',
    fallbackBehavior: 'GSC uniquement pour les rankings',
    degradedOutput: 'Rankings limités aux mots-clés déjà connus via GSC',
  },
];

export async function auditRankings(
  inputs: Opt06Inputs,
  userId: string,
): Promise<PageRanking[]> {
  const rankings: PageRanking[] = [];

  try {
    const gscPages = inputs.gscConnected
      ? await getTopPages(inputs.siteUrl, userId, 100)
      : [];

    for (const page of gscPages) {
      const keywords = inputs.targetKeywords[page.url] ?? [];
      const keyword = keywords[0] ?? extractSlugKeyword(page.url);
      rankings.push({
        url: page.url,
        keyword,
        currentPosition: Math.round(page.position),
        targetPosition: page.position <= 3 ? 1 : 3,
        monthlyTraffic: page.clicks * 30,
        isLowHanging:
          page.position >= LOW_HANGING_POSITION_RANGE.min &&
          page.position <= LOW_HANGING_POSITION_RANGE.max,
      });
    }
  } catch {
    // fallback: build from targetPages with DataForSEO
    for (const url of inputs.targetPages) {
      const keywords = inputs.targetKeywords[url] ?? [];
      const keyword = keywords[0] ?? extractSlugKeyword(url);
      try {
        const positions = await getRankings(
          inputs.siteUrl,
          [keyword],
          inputs.geoTargets?.[0] ?? 'FR',
        );
        const pos = positions[keyword] ?? 50;
        rankings.push({
          url,
          keyword,
          currentPosition: pos,
          targetPosition: 3,
          monthlyTraffic: 0,
          isLowHanging:
            pos >= LOW_HANGING_POSITION_RANGE.min && pos <= LOW_HANGING_POSITION_RANGE.max,
        });
      } catch {
        rankings.push({
          url,
          keyword,
          currentPosition: 50,
          targetPosition: 3,
          monthlyTraffic: 0,
          isLowHanging: false,
        });
      }
    }
  }

  // Enrich with Ahrefs or SEMrush organic keywords if connected
  const domain = new URL(inputs.siteUrl).hostname;
  const geo = inputs.geoTargets?.[0] ?? 'FR';

  const ahrefsConnected = await isToolConnected('ahrefs', userId);
  const semrushConnected = await isToolConnected('semrush', userId);

  if (ahrefsConnected) {
    try {
      const ahrefsKw = await ahrefsGetOrganicKeywords(domain, geo, userId, 50);
      for (const kw of ahrefsKw) {
        const existing = rankings.find((r) => r.url === kw.url);
        if (existing) {
          existing.currentPosition = kw.position;
          existing.isLowHanging =
            kw.position >= LOW_HANGING_POSITION_RANGE.min &&
            kw.position <= LOW_HANGING_POSITION_RANGE.max;
        } else if (inputs.targetPages.includes(kw.url)) {
          rankings.push({
            url: kw.url,
            keyword: kw.keyword,
            currentPosition: kw.position,
            targetPosition: kw.position <= 3 ? 1 : 3,
            monthlyTraffic: 0,
            isLowHanging:
              kw.position >= LOW_HANGING_POSITION_RANGE.min &&
              kw.position <= LOW_HANGING_POSITION_RANGE.max,
          });
        }
      }
    } catch {
      // Ahrefs enrichment failed — keep existing rankings
    }
  } else if (semrushConnected) {
    try {
      const semrushKw = await semrushGetDomainKeywords(domain, geo, userId, 50);
      for (const kw of semrushKw) {
        const existing = rankings.find((r) => r.keyword === kw.keyword);
        if (existing) {
          existing.currentPosition = kw.position;
          existing.isLowHanging =
            kw.position >= LOW_HANGING_POSITION_RANGE.min &&
            kw.position <= LOW_HANGING_POSITION_RANGE.max;
        }
      }
    } catch {
      // SEMrush enrichment failed — keep existing rankings
    }
  }

  return rankings;
}

export function scoreOpportunities(
  rankings: PageRanking[],
  inputs: Opt06Inputs,
): OptimizationOpportunity[] {
  return rankings
    .map((r) => {
      const impactScore = computeImpactScore(r);
      const effortScore = computeEffortScore(r);
      const priorityScore = Math.round(impactScore * 0.6 + (100 - effortScore) * 0.4);
      const targets = detectOptimizationTargets(r, inputs);

      return {
        url: r.url,
        keyword: r.keyword,
        currentPosition: r.currentPosition,
        optimizationTargets: targets,
        impactScore,
        effortScore,
        priorityScore,
        requiresHumanValidation:
          r.monthlyTraffic >= HIGH_TRAFFIC_THRESHOLD || targets.includes('content'),
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

export function applyAutoCorrections(
  opportunities: OptimizationOpportunity[],
  automationLevel: Opt06Inputs['automationLevel'],
): OptimizationLog[] {
  if (automationLevel === 'audit') return [];

  const logs: OptimizationLog[] = [];

  for (const opp of opportunities) {
    if (opp.requiresHumanValidation && automationLevel !== 'full-auto') continue;

    for (const target of opp.optimizationTargets) {
      if (target === 'content' && automationLevel === 'semi-auto') continue;

      const correction: CmsCorrection = {
        url: opp.url,
        field: target,
        oldValue: '',
        newValue: `[optimized:${target}:${opp.keyword}]`,
        autoFixable: !opp.requiresHumanValidation,
        appliedAt: new Date(),
      };

      logs.push({
        url: opp.url,
        target,
        correction,
        appliedAt: new Date(),
        automationLevel: opp.requiresHumanValidation ? 'validated' : 'auto',
      });
    }
  }

  return logs;
}

// ─── LLM meta enrichment ────────────────────────────────

export async function enrichCorrectionsWithLlm(
  logs: OptimizationLog[],
): Promise<OptimizationLog[]> {
  const metaLogs = logs.filter((l) => l.target === 'meta');
  if (metaLogs.length === 0) return logs;

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const pageList = metaLogs
      .map((l) => {
        const kw = l.correction.newValue.replace(/^\[optimized:meta:/, '').replace(/\]$/, '');
        return `- URL: ${l.url}, Keyword: ${kw}`;
      })
      .join('\n');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Génère des meta title (max 60 car.) et meta description (155-160 car.) SEO pour :\n\n${pageList}\n\nRéponds uniquement en JSON array: [{"url":"...","metaTitle":"...","metaDescription":"..."}]`,
      }],
    });

    const textBlock = message.content.find((c) => c.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : '';
    const jsonMatch = /\[[\s\S]*\]/.exec(text);
    if (!jsonMatch) return logs;

    const generated = JSON.parse(jsonMatch[0]) as { url: string; metaTitle: string; metaDescription: string }[];
    const metaMap = new Map(generated.map((g) => [g.url, g]));

    return logs.map((log) => {
      if (log.target !== 'meta') return log;
      const meta = metaMap.get(log.url);
      if (!meta) return log;
      return {
        ...log,
        correction: {
          ...log.correction,
          newValue: JSON.stringify({ metaTitle: meta.metaTitle, metaDescription: meta.metaDescription }),
        },
      };
    });
  } catch {
    return logs;
  }
}

// ─── CMS correction push ──────────────────────────────────

export async function pushCorrections(
  logs: OptimizationLog[],
  automationLevel: Opt06Inputs['automationLevel'],
  cmsType: string,
  wpCredentials?: WordPressCredentials,
  hubCreds?: HubSpotCredentials,
  shopifyCreds?: ShopifyCredentials,
  webflowCreds?: WebflowCredentials,
): Promise<CorrectionPushResult> {
  if (logs.length === 0) {
    return { applied: [], pending: [], failed: [], csvExport: null };
  }

  // audit mode: never apply, always export
  if (automationLevel === 'audit') {
    return {
      applied: [],
      pending: [],
      failed: [],
      csvExport: formatCorrectionsAsCsv(logs),
    };
  }

  // Split by autoFixable: autoFixable items can be applied in full-auto,
  // non-autoFixable items are pending (need human validation)
  const autoFixable = logs.filter((l) => l.correction.autoFixable);
  const needsValidation = logs.filter((l) => !l.correction.autoFixable);

  // semi-auto: everything goes to pending for approval
  if (automationLevel === 'semi-auto') {
    return {
      applied: [],
      pending: logs,
      failed: [],
      csvExport: cmsType !== 'wordpress' ? formatCorrectionsAsCsv(logs) : null,
    };
  }

  // full-auto: apply autoFixable corrections, pending for the rest
  if (cmsType === 'wordpress' && wpCredentials) {
    return pushToWordPress(autoFixable, needsValidation, wpCredentials);
  }

  if (cmsType === 'hubspot' && hubCreds) {
    return pushToHubSpot(autoFixable, needsValidation, hubCreds);
  }

  if (cmsType === 'shopify' && shopifyCreds) {
    return pushToShopify(autoFixable, needsValidation, shopifyCreds);
  }

  if (cmsType === 'webflow' && webflowCreds) {
    return pushToWebflow(autoFixable, needsValidation, webflowCreds);
  }

  // Unsupported CMS: export to CSV
  return {
    applied: [],
    pending: needsValidation,
    failed: [],
    csvExport: formatCorrectionsAsCsv(logs),
  };
}

async function pushToWordPress(
  toApply: OptimizationLog[],
  pending: OptimizationLog[],
  creds: WordPressCredentials,
): Promise<CorrectionPushResult> {
  const applied: OptimizationLog[] = [];
  const failed: { log: OptimizationLog; reason: string }[] = [];

  // Only push meta corrections — content and schema require more complex handling
  const metaLogs = toApply.filter((l) => l.target === 'meta');
  const nonMetaLogs = toApply.filter((l) => l.target !== 'meta');

  // Resolve URL → WordPress page/post ID
  let wpPageMap: Map<string, { id: number; postType: 'pages' | 'posts' }>;
  try {
    wpPageMap = await buildWpPageMap(creds);
  } catch {
    // WordPress unreachable — export all as CSV
    return {
      applied: [],
      pending: [...toApply, ...pending],
      failed: [],
      csvExport: formatCorrectionsAsCsv([...toApply, ...pending]),
    };
  }

  for (const log of metaLogs) {
    const wpEntry = wpPageMap.get(normalizeUrl(log.url));
    if (!wpEntry) {
      failed.push({ log, reason: 'Page non trouvée dans WordPress' });
      continue;
    }

    try {
      const metaValues = parseMetaNewValue(log.correction.newValue);
      await wpUpdateMeta(
        creds,
        wpEntry.id,
        metaValues.metaTitle,
        metaValues.metaDescription,
        wpEntry.postType,
      );
      applied.push({
        ...log,
        appliedAt: new Date(),
        automationLevel: 'auto',
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Erreur WordPress API';
      failed.push({ log, reason });
    }
  }

  // Non-meta corrections go to pending (content/schema require manual review)
  const allPending = [...pending, ...nonMetaLogs];

  return {
    applied,
    pending: allPending,
    failed,
    csvExport: allPending.length > 0 || failed.length > 0
      ? formatCorrectionsAsCsv([...allPending, ...failed.map((f) => f.log)])
      : null,
  };
}

async function pushToHubSpot(
  toApply: OptimizationLog[],
  pending: OptimizationLog[],
  creds: HubSpotCredentials,
): Promise<CorrectionPushResult> {
  const applied: OptimizationLog[] = [];
  const failed: { log: OptimizationLog; reason: string }[] = [];

  const metaLogs = toApply.filter((l) => l.target === 'meta');
  const nonMetaLogs = toApply.filter((l) => l.target !== 'meta');

  let pageMap: Map<string, { id: string; type: 'page' | 'post' }>;
  try {
    pageMap = await hubGetPageMap(creds);
  } catch {
    return {
      applied: [],
      pending: [...toApply, ...pending],
      failed: [],
      csvExport: formatCorrectionsAsCsv([...toApply, ...pending]),
    };
  }

  for (const log of metaLogs) {
    const entry = pageMap.get(normalizeUrl(log.url));
    if (!entry) {
      failed.push({ log, reason: 'Page non trouvée dans HubSpot' });
      continue;
    }

    try {
      const metaValues = parseMetaNewValue(log.correction.newValue);
      await hubUpdateMeta(creds, entry.id, {
        title: metaValues.metaTitle || undefined,
        metaDescription: metaValues.metaDescription || undefined,
      }, entry.type);
      applied.push({ ...log, appliedAt: new Date(), automationLevel: 'auto' });
    } catch (err) {
      failed.push({ log, reason: err instanceof Error ? err.message : 'HubSpot API error' });
    }
  }

  const allPending = [...pending, ...nonMetaLogs];

  return {
    applied,
    pending: allPending,
    failed,
    csvExport: allPending.length > 0 || failed.length > 0
      ? formatCorrectionsAsCsv([...allPending, ...failed.map((f) => f.log)])
      : null,
  };
}

async function pushToShopify(
  toApply: OptimizationLog[],
  pending: OptimizationLog[],
  creds: ShopifyCredentials,
): Promise<CorrectionPushResult> {
  const applied: OptimizationLog[] = [];
  const failed: { log: OptimizationLog; reason: string }[] = [];

  const metaLogs = toApply.filter((l) => l.target === 'meta');
  const nonMetaLogs = toApply.filter((l) => l.target !== 'meta');

  let pageMap: Map<string, { type: 'page' | 'product'; id: number }>;
  try {
    pageMap = await shopifyGetPageMap(creds);
  } catch {
    return {
      applied: [],
      pending: [...toApply, ...pending],
      failed: [],
      csvExport: formatCorrectionsAsCsv([...toApply, ...pending]),
    };
  }

  for (const log of metaLogs) {
    const entry = pageMap.get(normalizeUrl(log.url));
    if (!entry) {
      failed.push({ log, reason: 'Page non trouvée dans Shopify' });
      continue;
    }

    try {
      const metaValues = parseMetaNewValue(log.correction.newValue);
      await shopifyUpdateMeta(creds, entry.type, entry.id, {
        title: metaValues.metaTitle || undefined,
        metaDescription: metaValues.metaDescription || undefined,
      });
      applied.push({ ...log, appliedAt: new Date(), automationLevel: 'auto' });
    } catch (err) {
      failed.push({ log, reason: err instanceof Error ? err.message : 'Shopify API error' });
    }
  }

  const allPending = [...pending, ...nonMetaLogs];

  return {
    applied,
    pending: allPending,
    failed,
    csvExport: allPending.length > 0 || failed.length > 0
      ? formatCorrectionsAsCsv([...allPending, ...failed.map((f) => f.log)])
      : null,
  };
}

async function pushToWebflow(
  toApply: OptimizationLog[],
  pending: OptimizationLog[],
  creds: WebflowCredentials,
): Promise<CorrectionPushResult> {
  const applied: OptimizationLog[] = [];
  const failed: { log: OptimizationLog; reason: string }[] = [];

  const metaLogs = toApply.filter((l) => l.target === 'meta');
  const nonMetaLogs = toApply.filter((l) => l.target !== 'meta');

  let siteMap: Map<string, { pageId?: string; collectionId?: string; itemId?: string; type: 'page' | 'blog' }>;
  try {
    siteMap = await webflowGetSiteMap(creds);
  } catch {
    return {
      applied: [],
      pending: [...toApply, ...pending],
      failed: [],
      csvExport: formatCorrectionsAsCsv([...toApply, ...pending]),
    };
  }

  for (const log of metaLogs) {
    const urlPath = normalizeUrl(new URL(log.url, 'https://placeholder').pathname);
    const entry = siteMap.get(urlPath);
    if (!entry) {
      failed.push({ log, reason: 'Page non trouvée dans Webflow' });
      continue;
    }

    try {
      const metaValues = parseMetaNewValue(log.correction.newValue);
      const meta = {
        title: metaValues.metaTitle || undefined,
        metaDescription: metaValues.metaDescription || undefined,
      };

      if (entry.type === 'page' && entry.pageId) {
        await webflowUpdatePageMeta(creds, entry.pageId, meta);
      } else if (entry.type === 'blog' && entry.collectionId && entry.itemId) {
        await webflowUpdateCollectionItemMeta(creds, entry.collectionId, entry.itemId, meta);
      } else {
        failed.push({ log, reason: 'Type Webflow non supporté' });
        continue;
      }
      applied.push({ ...log, appliedAt: new Date(), automationLevel: 'auto' });
    } catch (err) {
      failed.push({ log, reason: err instanceof Error ? err.message : 'Webflow API error' });
    }
  }

  const allPending = [...pending, ...nonMetaLogs];
  return {
    applied,
    pending: allPending,
    failed,
    csvExport: allPending.length > 0 || failed.length > 0
      ? formatCorrectionsAsCsv([...allPending, ...failed.map((f) => f.log)])
      : null,
  };
}

async function buildWpPageMap(
  creds: WordPressCredentials,
): Promise<Map<string, { id: number; postType: 'pages' | 'posts' }>> {
  const map = new Map<string, { id: number; postType: 'pages' | 'posts' }>();

  const [pages, posts] = await Promise.allSettled([
    wpGetPages(creds, 100),
    wpGetPosts(creds, 100),
  ]);

  const addToMap = (items: WordPressPage[], postType: 'pages' | 'posts') => {
    for (const item of items) {
      map.set(normalizeUrl(item.url), { id: item.id, postType });
    }
  };

  if (pages.status === 'fulfilled') addToMap(pages.value, 'pages');
  if (posts.status === 'fulfilled') addToMap(posts.value, 'posts');

  return map;
}

function parseMetaNewValue(newValue: string): { metaTitle: string; metaDescription: string } {
  // Try JSON format first (from future real values)
  try {
    const parsed = JSON.parse(newValue) as { metaTitle?: string; metaDescription?: string };
    if (parsed.metaTitle || parsed.metaDescription) {
      return {
        metaTitle: parsed.metaTitle ?? '',
        metaDescription: parsed.metaDescription ?? '',
      };
    }
  } catch {
    // Not JSON — use as meta description directly
  }
  return { metaTitle: '', metaDescription: newValue };
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '').toLowerCase();
}

function formatCorrectionsAsCsv(logs: OptimizationLog[]): string {
  const header = 'url,target,field,old_value,new_value,auto_fixable,automation_level';
  const rows = logs.map((log) => {
    const c = log.correction;
    return [
      csvEscape(log.url),
      csvEscape(log.target),
      csvEscape(c.field),
      csvEscape(c.oldValue),
      csvEscape(c.newValue),
      c.autoFixable ? 'true' : 'false',
      log.automationLevel,
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function detectAlerts(
  current: PageRanking[],
  previous: PageRanking[],
): MonitoringAlert[] {
  const alerts: MonitoringAlert[] = [];
  const prevMap = new Map(previous.map((r) => [`${r.url}:${r.keyword}`, r]));

  for (const r of current) {
    const prev = prevMap.get(`${r.url}:${r.keyword}`);
    if (!prev) continue;

    const drop = r.currentPosition - prev.currentPosition;
    if (drop >= ALERT_POSITION_DROP_THRESHOLD) {
      alerts.push({
        url: r.url,
        keyword: r.keyword,
        type: 'ranking_drop',
        severity: drop >= 10 ? 'critical' : drop >= 5 ? 'high' : 'medium',
        message: `Position ${prev.currentPosition} → ${r.currentPosition} (−${drop}) sur "${r.keyword}"`,
        triggeredAt: new Date(),
      });
    }

    if (r.isLowHanging && !prev.isLowHanging) {
      alerts.push({
        url: r.url,
        keyword: r.keyword,
        type: 'new_opportunity',
        severity: 'medium',
        message: `Nouvelle opportunité fruit mûr : pos. ${r.currentPosition} sur "${r.keyword}"`,
        triggeredAt: new Date(),
      });
    }
  }

  return alerts;
}

// — helpers —

function computeImpactScore(r: PageRanking): number {
  const positionGain = Math.max(0, r.currentPosition - r.targetPosition);
  const trafficWeight = Math.min(r.monthlyTraffic / 100, 30);
  const lowHangingBonus = r.isLowHanging ? 20 : 0;
  return Math.min(Math.round(positionGain * 2 + trafficWeight + lowHangingBonus), 100);
}

function computeEffortScore(r: PageRanking): number {
  if (r.currentPosition <= 10) return 30;
  if (r.currentPosition <= 20) return 50;
  if (r.currentPosition <= 50) return 70;
  return 90;
}

function detectOptimizationTargets(
  r: PageRanking,
  inputs: Opt06Inputs,
): OptimizationTarget[] {
  const targets: OptimizationTarget[] = ['meta'];
  if (r.currentPosition > 20) targets.push('content');
  if (r.currentPosition > 10) targets.push('schema');
  targets.push('internal_links');
  if (inputs.googleBusinessProfileId) targets.push('gbp');
  return targets;
}

function extractSlugKeyword(url: string): string {
  return url.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') ?? '';
}

export { FALLBACKS };
