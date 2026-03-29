import { WorkflowStep, GracefulFallback } from '../../../core/types';
import { crawlSite, getRankings } from '../../../core/tools/dataForSeo';
import { getTopPages, getLowHangingFruit } from '../../../core/tools/gsc';
import { Tsi07Inputs, TechnicalAuditReport, ActionPlan, CrawlSummary } from './types';
import { SeoIssue, IssueLevel } from '../../../core/types';

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
      name: 'Crawl complet du site',
      status: 'done',
      data: results,
    };
  } catch {
    return {
      id: 'crawl',
      name: 'Crawl complet du site',
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

export { FALLBACKS };
