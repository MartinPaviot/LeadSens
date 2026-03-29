import { KwScore } from '../../../core/types';

export type PageType = 'about' | 'service' | 'landing' | 'pillar' | 'contact' | 'category';
export type ExportFormat = 'html' | 'markdown' | 'wordpress' | 'hubspot' | 'shopify' | 'sheets';

export interface Wpw09Inputs {
  pageType: PageType;
  pageUrl?: string;
  brief: string;
  targetKeywords?: string[];
  brandTone: string;
  targetAudience: string;
  internalLinksAvailable: string[];
  cmsType: 'wordpress' | 'hubspot' | 'shopify' | 'webflow' | 'other';
  exportFormat: ExportFormat;
  kga08Context?: KwScore[];
}

export interface PageStructure {
  metaTitles: string[];
  metaDescription: string;
  h1Options: string[];
  h2s: string[];
  h3s: Record<string, string[]>;
}

export interface InternalLink {
  anchor: string;
  url: string;
}

export interface Wpw09PageOutput {
  metaTitle: string;
  metaDescription: string;
  h1: string;
  structure: PageStructure;
  bodyContent: string;
  internalLinks: InternalLink[];
  cta: string[];
  imageRecommendations: { description: string; altText: string }[];
  wordCount: number;
  exportReady: boolean;
}

export interface WordCountRange {
  min: number;
  max: number;
}

export const PAGE_WORD_COUNT: Record<PageType, WordCountRange> = {
  about:    { min: 600,  max: 1500 },
  service:  { min: 800,  max: 2000 },
  landing:  { min: 500,  max: 1200 },
  pillar:   { min: 2000, max: 5000 },
  contact:  { min: 200,  max: 500  },
  category: { min: 300,  max: 800  },
};
