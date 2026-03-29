import { SeoIssue, IssueLevel, CmsCorrection } from '../../../core/types';

export interface Tsi07Inputs {
  siteUrl: string;
  cmsType: string;
  automationLevel: 'audit' | 'semi-auto' | 'full-auto';
  priorityPages: string[];
  alertChannel: 'slack' | 'email' | 'report';
  gscConnected: boolean;
  gaConnected: boolean;
}

export interface CrawlSummary {
  totalUrls: number;
  indexable: number;
  blocked: number;
  errors: number;
  crawledAt: Date;
}

export interface TechnicalAuditReport {
  siteUrl: string;
  crawlSummary: CrawlSummary;
  issues: SeoIssue[];
  issuesByLevel: Record<IssueLevel, SeoIssue[]>;
  autoFixableCount: number;
  generatedAt: Date;
}

export interface ActionPlan {
  immediate: SeoIssue[];  // critical
  thisWeek: SeoIssue[];   // high
  thisMonth: SeoIssue[];  // medium
  monitor: SeoIssue[];    // watch
}

export interface Tsi07Output {
  report: TechnicalAuditReport;
  actionPlan: ActionPlan;
  correctionsApplied: CmsCorrection[];
  monitoringActive: boolean;
}
