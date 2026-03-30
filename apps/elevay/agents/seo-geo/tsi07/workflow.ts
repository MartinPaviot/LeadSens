import { WorkflowStep, GracefulFallback, CmsCorrection } from '../../../core/types';
import { crawlSite, getRankings } from '../../../core/tools/dataForSeo';
import { getTopPages, getLowHangingFruit } from '../../../core/tools/gsc';
import { Tsi07Inputs, TechnicalAuditReport, ActionPlan, CrawlSummary, Tsi07CorrectionResult } from './types';
import { SeoIssue, IssueLevel } from '../../../core/types';
import {
  wpGetPages,
  wpGetPosts,
  wpUpdateMeta,
  wpUpdateCanonical,
  type WordPressCredentials,
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

const FALLBACKS: GracefulFallback[] = [
  {
    missingTool: 'gsc',
    fallbackBehavior: 'DataForSEO crawl uniquement — données trafic non disponibles',
    degradedOutput: "Priorisation par type d'erreur, non par impact trafic",
  },
  {
    missingTool: 'ga',
    fallbackBehavior: "Priorisation par niveau d'erreur uniquement",
    degradedOutput: 'Seuil 1000 visites/mois non applicable — validation humaine élargie',
  },
  {
    missingTool: 'dataForSeo',
    fallbackBehavior: 'Audit impossible sans crawl',
    degradedOutput: 'Agent non activable — DataForSEO requis',
  },
];

export async function runCrawl(
  inputs: Tsi07Inputs,
): Promise<WorkflowStep & { data?: Awaited<ReturnType<typeof crawlSite>> }> {
  try {
    const results = await crawlSite(inputs.siteUrl);
    return {
      id: 'crawl',
      name: 'Full site crawl',
      status: 'done',
      data: results,
    };
  } catch {
    return {
      id: 'crawl',
      name: 'Full site crawl',
      status: 'error',
    };
  }
}

export async function fetchGscData(
  inputs: Tsi07Inputs,
  userId: string,
): Promise<WorkflowStep & { pages?: Awaited<ReturnType<typeof getTopPages>> }> {
  if (!inputs.gscConnected) {
    return { id: 'gsc', name: 'Google Search Console', status: 'skipped' };
  }
  try {
    const pages = await getTopPages(inputs.siteUrl, userId);
    return { id: 'gsc', name: 'Google Search Console', status: 'done', pages };
  } catch {
    return { id: 'gsc', name: 'Google Search Console', status: 'error' };
  }
}

export function classifyIssues(
  crawlResults: Awaited<ReturnType<typeof crawlSite>>,
): SeoIssue[] {
  return crawlResults.flatMap((r) => {
    const issues: SeoIssue[] = [];

    if (r.statusCode === 404) {
      issues.push({
        type: '404',
        level: 'critical',
        url: r.url,
        description: `Page introuvable (404) : ${r.url}`,
        recommendedAction: 'Créer une redirection 301 vers la page la plus pertinente',
        autoFixable: false,
      });
    }

    if (r.statusCode >= 500) {
      issues.push({
        type: 'server_error',
        level: 'critical',
        url: r.url,
        description: `Erreur serveur (${r.statusCode}) : ${r.url}`,
        recommendedAction: 'Vérifier la configuration serveur',
        autoFixable: false,
      });
    }

    if (!r.indexable && r.statusCode === 200) {
      issues.push({
        type: 'noindex',
        level: 'high',
        url: r.url,
        description: `Page bloquée à l'indexation : ${r.url}`,
        recommendedAction: 'Vérifier balise noindex et robots.txt',
        autoFixable: false,
      });
    }

    if (!r.metaDescription) {
      issues.push({
        type: 'missing_meta_description',
        level: 'medium',
        url: r.url,
        description: `Meta description manquante : ${r.url}`,
        recommendedAction: 'Générer une meta description via AGT-SEO-MDG-11',
        autoFixable: true,
      });
    }

    if (!r.title && r.statusCode === 200) {
      issues.push({
        type: 'missing_title',
        level: 'high',
        url: r.url,
        description: `Balise title manquante : ${r.url}`,
        recommendedAction: 'Ajouter une balise title pertinente pour cette page',
        autoFixable: false,
      });
    }

    if (r.indexable && !r.canonical) {
      issues.push({
        type: 'missing_canonical',
        level: 'medium',
        url: r.url,
        description: `Canonical manquant sur page indexable : ${r.url}`,
        recommendedAction: 'Ajouter une balise canonical self-referencing',
        autoFixable: true,
      });
    }

    if (r.canonical && r.canonical !== r.url) {
      issues.push({
        type: 'wrong_canonical',
        level: 'high',
        url: r.url,
        description: `Canonical pointant ailleurs (${r.canonical}) : ${r.url}`,
        recommendedAction: 'Corriger la canonical pour pointer vers la page elle-même',
        autoFixable: true,
      });
    }

    if (r.internalLinks.length === 0 && r.indexable) {
      issues.push({
        type: 'orphan_page',
        level: 'high',
        url: r.url,
        description: `Page orpheline (aucun lien interne entrant) : ${r.url}`,
        recommendedAction: 'Ajouter des liens internes depuis les pages proches',
        autoFixable: false,
      });
    }

    return issues;
  });
}

export function buildActionPlan(issues: SeoIssue[]): ActionPlan {
  const byLevel = groupByLevel(issues);
  return {
    immediate: byLevel.critical,
    thisWeek: byLevel.high,
    thisMonth: byLevel.medium,
    monitor: byLevel.watch,
  };
}

export function buildReport(
  siteUrl: string,
  crawlResults: Awaited<ReturnType<typeof crawlSite>>,
  issues: SeoIssue[],
): TechnicalAuditReport {
  const crawlSummary: CrawlSummary = {
    totalUrls: crawlResults.length,
    indexable: crawlResults.filter((r) => r.indexable).length,
    blocked: crawlResults.filter((r) => !r.indexable).length,
    errors: crawlResults.filter((r) => r.statusCode >= 400).length,
    crawledAt: new Date(),
  };

  return {
    siteUrl,
    crawlSummary,
    issues,
    issuesByLevel: groupByLevel(issues),
    autoFixableCount: issues.filter((i) => i.autoFixable).length,
    generatedAt: new Date(),
  };
}

function groupByLevel(issues: SeoIssue[]): Record<IssueLevel, SeoIssue[]> {
  return {
    critical: issues.filter((i) => i.level === 'critical'),
    high: issues.filter((i) => i.level === 'high'),
    medium: issues.filter((i) => i.level === 'medium'),
    watch: issues.filter((i) => i.level === 'watch'),
  };
}

// ─── CMS corrections push ────────────────────────────────

export async function pushTsi07Corrections(
  issues: SeoIssue[],
  automationLevel: Tsi07Inputs['automationLevel'],
  cmsType: string,
  wpCredentials?: WordPressCredentials,
  hubCreds?: HubSpotCredentials,
  shopifyCreds?: ShopifyCredentials,
  webflowCreds?: WebflowCredentials,
): Promise<Tsi07CorrectionResult> {
  const autoFixable = issues.filter((i) => i.autoFixable);
  const nonFixable = issues.filter((i) => !i.autoFixable);

  if (autoFixable.length === 0) {
    return { applied: [], pending: nonFixable, failed: [], csvExport: null };
  }

  // audit mode: CSV export only
  if (automationLevel === 'audit') {
    return {
      applied: [],
      pending: [],
      failed: [],
      csvExport: formatIssuesAsCsv(issues),
    };
  }

  // semi-auto: everything pending for human approval
  if (automationLevel === 'semi-auto') {
    return {
      applied: [],
      pending: issues,
      failed: [],
      csvExport: cmsType !== 'wordpress' ? formatIssuesAsCsv(issues) : null,
    };
  }

  // full-auto: apply meta/canonical/alt corrections to CMS
  if (cmsType === 'wordpress' && wpCredentials) {
    return applyToWordPress(autoFixable, nonFixable, wpCredentials);
  }

  if (cmsType === 'hubspot' && hubCreds) {
    return applyToHubSpot(autoFixable, nonFixable, hubCreds);
  }

  if (cmsType === 'shopify' && shopifyCreds) {
    return applyToShopify(autoFixable, nonFixable, shopifyCreds);
  }

  if (cmsType === 'webflow' && webflowCreds) {
    return applyToWebflow(autoFixable, nonFixable, webflowCreds);
  }

  // Unsupported CMS: CSV fallback
  return {
    applied: [],
    pending: nonFixable,
    failed: [],
    csvExport: formatIssuesAsCsv(issues),
  };
}

async function applyToWordPress(
  autoFixable: SeoIssue[],
  nonFixable: SeoIssue[],
  creds: WordPressCredentials,
): Promise<Tsi07CorrectionResult> {
  const applied: CmsCorrection[] = [];
  const failed: { issue: SeoIssue; reason: string }[] = [];

  // Build URL → WP ID map
  let pageMap: Map<string, { id: number; postType: 'pages' | 'posts' }>;
  try {
    pageMap = new Map();
    const [pages, posts] = await Promise.allSettled([
      wpGetPages(creds, 100),
      wpGetPosts(creds, 100),
    ]);
    if (pages.status === 'fulfilled') {
      for (const p of pages.value) {
        pageMap.set(normalizeUrl(p.url), { id: p.id, postType: 'pages' });
      }
    }
    if (posts.status === 'fulfilled') {
      for (const p of posts.value) {
        pageMap.set(normalizeUrl(p.url), { id: p.id, postType: 'posts' });
      }
    }
  } catch {
    // WP unreachable — CSV fallback
    return {
      applied: [],
      pending: [...autoFixable, ...nonFixable],
      failed: [],
      csvExport: formatIssuesAsCsv([...autoFixable, ...nonFixable]),
    };
  }

  for (const issue of autoFixable) {
    const wpEntry = pageMap.get(normalizeUrl(issue.url));

    if (issue.type === 'missing_meta_description') {
      if (!wpEntry) {
        failed.push({ issue, reason: 'Page non trouvée dans WordPress' });
        continue;
      }
      try {
        const correction = await wpUpdateMeta(
          creds,
          wpEntry.id,
          '', // don't change title
          `Description pour ${issue.url.split('/').pop()?.replace(/-/g, ' ') ?? 'cette page'}`,
          wpEntry.postType,
        );
        applied.push(correction);
      } catch (err) {
        failed.push({ issue, reason: err instanceof Error ? err.message : 'WordPress API error' });
      }
    } else if (issue.type === 'missing_canonical' || issue.type === 'wrong_canonical') {
      if (!wpEntry) {
        failed.push({ issue, reason: 'Page non trouvée dans WordPress' });
        continue;
      }
      try {
        const correction = await wpUpdateCanonical(
          creds,
          wpEntry.id,
          issue.url, // self-referencing canonical
          wpEntry.postType,
        );
        applied.push(correction);
      } catch (err) {
        failed.push({ issue, reason: err instanceof Error ? err.message : 'WordPress API error' });
      }
    }
    // broken_internal_link and redirect_chain: never auto-fix (too risky)
  }

  return {
    applied,
    pending: nonFixable,
    failed,
    csvExport: failed.length > 0 ? formatIssuesAsCsv(failed.map((f) => f.issue)) : null,
  };
}

async function applyToHubSpot(
  autoFixable: SeoIssue[],
  nonFixable: SeoIssue[],
  creds: HubSpotCredentials,
): Promise<Tsi07CorrectionResult> {
  const applied: CmsCorrection[] = [];
  const failed: { issue: SeoIssue; reason: string }[] = [];

  let pageMap: Map<string, { id: string; type: 'page' | 'post' }>;
  try {
    pageMap = await hubGetPageMap(creds);
  } catch {
    return {
      applied: [],
      pending: [...autoFixable, ...nonFixable],
      failed: [],
      csvExport: formatIssuesAsCsv([...autoFixable, ...nonFixable]),
    };
  }

  for (const issue of autoFixable) {
    const entry = pageMap.get(normalizeUrl(issue.url));

    if (issue.type === 'missing_meta_description' || issue.type === 'missing_canonical' || issue.type === 'wrong_canonical') {
      if (!entry) {
        failed.push({ issue, reason: 'Page non trouvée dans HubSpot' });
        continue;
      }
      try {
        const meta: { metaDescription?: string; canonical?: string } = {};
        if (issue.type === 'missing_meta_description') {
          meta.metaDescription = `Description pour ${issue.url.split('/').pop()?.replace(/-/g, ' ') ?? 'cette page'}`;
        } else {
          meta.canonical = issue.url;
        }
        const correction = await hubUpdateMeta(creds, entry.id, meta, entry.type);
        applied.push(correction);
      } catch (err) {
        failed.push({ issue, reason: err instanceof Error ? err.message : 'HubSpot API error' });
      }
    }
  }

  return {
    applied,
    pending: nonFixable,
    failed,
    csvExport: failed.length > 0 ? formatIssuesAsCsv(failed.map((f) => f.issue)) : null,
  };
}

async function applyToShopify(
  autoFixable: SeoIssue[],
  nonFixable: SeoIssue[],
  creds: ShopifyCredentials,
): Promise<Tsi07CorrectionResult> {
  const applied: CmsCorrection[] = [];
  const failed: { issue: SeoIssue; reason: string }[] = [];

  const metaFixes = autoFixable.filter((i) => i.type === 'missing_meta_description');
  const canonicalFixes = autoFixable.filter((i) => i.type === 'missing_canonical' || i.type === 'wrong_canonical');

  // Canonical fixes can't be applied on Shopify — move to pending
  const allPending: SeoIssue[] = [...nonFixable, ...canonicalFixes];

  if (metaFixes.length === 0) {
    return { applied: [], pending: allPending, failed: [], csvExport: null };
  }

  let pageMap: Map<string, { type: 'page' | 'product'; id: number }>;
  try {
    pageMap = await shopifyGetPageMap(creds);
  } catch {
    allPending.push(...metaFixes);
    return {
      applied: [],
      pending: allPending,
      failed: [],
      csvExport: formatIssuesAsCsv([...metaFixes, ...allPending]),
    };
  }

  for (const issue of metaFixes) {
    const entry = pageMap.get(normalizeUrl(issue.url));
    if (!entry) {
      failed.push({ issue, reason: 'Page non trouvée dans Shopify' });
      continue;
    }
    try {
      const correction = await shopifyUpdateMeta(creds, entry.type, entry.id, {
        metaDescription: `Description pour ${issue.url.split('/').pop()?.replace(/-/g, ' ') ?? 'cette page'}`,
      });
      applied.push(correction);
    } catch (err) {
      failed.push({ issue, reason: err instanceof Error ? err.message : 'Shopify API error' });
    }
  }

  return {
    applied,
    pending: allPending,
    failed,
    csvExport: failed.length > 0 ? formatIssuesAsCsv(failed.map((f) => f.issue)) : null,
  };
}

async function applyToWebflow(
  autoFixable: SeoIssue[],
  nonFixable: SeoIssue[],
  creds: WebflowCredentials,
): Promise<Tsi07CorrectionResult> {
  const applied: CmsCorrection[] = [];
  const failed: { issue: SeoIssue; reason: string }[] = [];

  const metaFixes = autoFixable.filter((i) => i.type === 'missing_meta_description');
  const canonicalFixes = autoFixable.filter((i) => i.type === 'missing_canonical' || i.type === 'wrong_canonical');

  // Canonical not supported in Webflow API — move to pending
  const allPending: SeoIssue[] = [...nonFixable, ...canonicalFixes];

  if (metaFixes.length === 0) {
    return { applied: [], pending: allPending, failed: [], csvExport: null };
  }

  let siteMap: Map<string, { pageId?: string; collectionId?: string; itemId?: string; type: 'page' | 'blog' }>;
  try {
    siteMap = await webflowGetSiteMap(creds);
  } catch {
    allPending.push(...metaFixes);
    return {
      applied: [],
      pending: allPending,
      failed: [],
      csvExport: formatIssuesAsCsv([...metaFixes, ...allPending]),
    };
  }

  for (const issue of metaFixes) {
    const urlPath = normalizeUrl(new URL(issue.url, 'https://placeholder').pathname);
    const entry = siteMap.get(urlPath);
    if (!entry) {
      failed.push({ issue, reason: 'Page non trouvée dans Webflow' });
      continue;
    }

    try {
      const metaDesc = `Description pour ${issue.url.split('/').pop()?.replace(/-/g, ' ') ?? 'cette page'}`;
      if (entry.type === 'page' && entry.pageId) {
        const correction = await webflowUpdatePageMeta(creds, entry.pageId, { metaDescription: metaDesc });
        applied.push(correction);
      } else if (entry.type === 'blog' && entry.collectionId && entry.itemId) {
        const correction = await webflowUpdateCollectionItemMeta(creds, entry.collectionId, entry.itemId, { metaDescription: metaDesc });
        applied.push(correction);
      } else {
        failed.push({ issue, reason: 'Type de page Webflow non supporté' });
      }
    } catch (err) {
      failed.push({ issue, reason: err instanceof Error ? err.message : 'Webflow API error' });
    }
  }

  return {
    applied,
    pending: allPending,
    failed,
    csvExport: failed.length > 0 ? formatIssuesAsCsv(failed.map((f) => f.issue)) : null,
  };
}

function formatIssuesAsCsv(issues: SeoIssue[]): string {
  const header = 'url,type,level,description,recommended_action,auto_fixable';
  const rows = issues.map((i) => [
    csvEscape(i.url),
    csvEscape(i.type),
    i.level,
    csvEscape(i.description),
    csvEscape(i.recommendedAction),
    i.autoFixable ? 'true' : 'false',
  ].join(','));
  return [header, ...rows].join('\n');
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '').toLowerCase();
}

export { FALLBACKS };
