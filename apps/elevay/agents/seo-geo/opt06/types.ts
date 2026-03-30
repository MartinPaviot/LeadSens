import { SeoIssue, KwScore, CmsCorrection } from '../../../core/types';

export type OptimizationTarget =
  | 'meta'
  | 'content'
  | 'schema'
  | 'internal_links'
  | 'gbp';

export interface Opt06Inputs {
  siteUrl: string;
  targetPages: string[];
  targetKeywords: Record<string, string[]>;
  competitors: string[];
  automationLevel: 'audit' | 'semi-auto' | 'full-auto';
  geoTargets?: string[];
  googleBusinessProfileId?: string;
  gscConnected: boolean;
  gaConnected: boolean;
}

export interface PageRanking {
  url: string;
  keyword: string;
  currentPosition: number;
  targetPosition: number;
  monthlyTraffic: number;
  isLowHanging: boolean;
}

export interface OptimizationOpportunity {
  url: string;
  keyword: string;
  currentPosition: number;
  optimizationTargets: OptimizationTarget[];
  impactScore: number;
  effortScore: number;
  priorityScore: number;
  requiresHumanValidation: boolean;
}

export interface OptimizationLog {
  url: string;
  target: OptimizationTarget;
  correction: CmsCorrection;
  appliedAt: Date;
  automationLevel: 'auto' | 'validated';
}

export interface RankingDelta {
  url: string;
  keyword: string;
  positionBefore: number;
  positionAfter: number;
  delta: number;
  measuredAt: Date;
}

export interface MonitoringAlert {
  url: string;
  keyword: string;
  type: 'ranking_drop' | 'traffic_drop' | 'new_opportunity';
  severity: 'critical' | 'high' | 'medium';
  message: string;
  triggeredAt: Date;
}

export interface CorrectionPushResult {
  applied: OptimizationLog[];
  pending: OptimizationLog[];
  failed: { log: OptimizationLog; reason: string }[];
  csvExport: string | null;
}

export interface Opt06Output {
  rankings: PageRanking[];
  opportunities: OptimizationOpportunity[];
  correctionsApplied: OptimizationLog[];
  correctionsPush: CorrectionPushResult | null;
  alerts: MonitoringAlert[];
  monitoringActive: boolean;
}

export const HIGH_TRAFFIC_THRESHOLD = 1000;
export const LOW_HANGING_POSITION_RANGE = { min: 4, max: 15 };
export const ALERT_POSITION_DROP_THRESHOLD = 3;
