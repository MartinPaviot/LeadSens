import { KwScore } from '../../../core/types';

export type ArticleFormat =
  | 'guide'
  | 'list'
  | 'case-study'
  | 'comparison'
  | 'opinion'
  | 'tutorial'
  | 'glossary';

export type Bsw10Mode = 'single' | 'cluster' | 'calendar';

export interface Bsw10Inputs {
  topic: string;
  mode: Bsw10Mode;
  articleFormat: ArticleFormat;
  targetAudience: string;
  expertiseLevel: 'beginner' | 'intermediate' | 'expert';
  objective: 'traffic' | 'lead-gen' | 'conversion' | 'brand-authority';
  brandTone: string;
  targetKeywords?: string[];
  internalLinksAvailable: string[];
  cta: string;
  cmsType: 'wordpress' | 'hubspot' | 'shopify' | 'webflow' | 'other';
  calendarDuration?: 30 | 60 | 90;
  kga08Context?: KwScore[];
}

export interface ArticleStructure {
  titleOptions: string[];
  h2s: string[];
  h3s: Record<string, string[]>;
  estimatedWordCount: number;
}

export interface SatelliteArticle {
  topic: string;
  format: ArticleFormat;
  targetKeyword: string;
  estimatedWordCount: number;
  publishOrder: number;
}

export interface ClusterArchitecture {
  pillarTopic: string;
  pillarWordCount: number;
  satellites: SatelliteArticle[];
  internalLinkingLogic: string;
}

export interface CalendarEntry {
  publishDate: string;
  topic: string;
  format: ArticleFormat;
  targetKeyword: string;
  status: 'planned';
}

export interface Bsw10Output {
  mode: Bsw10Mode;
  articleStructure: ArticleStructure;
  bodyContent: string;
  wordCount: number;
  clusterArchitecture?: ClusterArchitecture;
  editorialCalendar?: CalendarEntry[];
  exportReady: boolean;
  wpDraftUrl?: string;
}

export const ARTICLE_WORD_COUNT: Record<ArticleFormat, { min: number; max: number }> = {
  guide:        { min: 1500, max: 3000 },
  list:         { min: 800,  max: 1500 },
  'case-study': { min: 800,  max: 1500 },
  comparison:   { min: 1200, max: 2500 },
  opinion:      { min: 600,  max: 1200 },
  tutorial:     { min: 1000, max: 2000 },
  glossary:     { min: 400,  max: 1000 },
};
