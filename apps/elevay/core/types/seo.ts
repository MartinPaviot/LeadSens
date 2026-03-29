export type IssueLevel = 'critical' | 'high' | 'medium' | 'watch';
export type SearchIntent = 'commercial' | 'informational' | 'navigational' | 'transactional';
export type ActionHorizon = 'M1' | 'M2' | 'M3';
export type RecommendedAction = 'create' | 'update' | 'blog';

export interface SeoIssue {
  type: string;
  level: IssueLevel;
  url: string;
  description: string;
  recommendedAction: string;
  autoFixable: boolean;
}

export interface KwScore {
  keyword: string;
  score: number;
  trafficPotential: number;
  seoDifficulty: number;
  businessValue: number;
  geoRelevance: number;
  geo: string;
  intent: SearchIntent;
  targetPage: string | 'create';
  recommendedAction: RecommendedAction;
  horizon: ActionHorizon;
}

export interface CmsCorrection {
  url: string;
  field: string;
  oldValue: string;
  newValue: string;
  autoFixable: boolean;
  appliedAt?: Date;
}
