import { GracefulFallback, CmsCorrection } from '../../../core/types';
import { getRankings } from '../../../core/tools/dataForSeo';
import { getSerp } from '../../../core/tools/serpApi';
import { getTopPages, getLowHangingFruit } from '../../../core/tools/gsc';
import {
  Opt06Inputs,
  PageRanking,
  OptimizationOpportunity,
  OptimizationTarget,
  OptimizationLog,
  MonitoringAlert,
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
