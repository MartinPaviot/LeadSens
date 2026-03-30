export type ImageType =
  | 'product'
  | 'team'
  | 'ui'
  | 'hero'
  | 'blog'
  | 'decorative';

export interface Alt12Inputs {
  siteUrl: string;
  scope: 'all' | 'blog' | 'products' | string[];
  cmsType: 'wordpress' | 'hubspot' | 'shopify' | 'webflow' | 'other';
  targetKeywords?: Record<string, string[]>;
  brandTone: 'descriptive' | 'informative' | 'marketing';
  language: string;
  specialRules?: string[];
  variationsCount: 1 | 2;
  inject: boolean;
}

export interface ImageContext {
  url: string;
  pageUrl: string;
  pageTitle: string;
  currentAlt: string;
  imageType: ImageType;
  targetKeyword: string;
  filename: string;
}

export interface AltVariation {
  text: string;
  charCount: number;
  hasKeyword: boolean;
  wcagCompliant: boolean;
  valid: boolean;
}

export interface AltTextResult {
  imageUrl: string;
  pageUrl: string;
  imageType: ImageType;
  targetKeyword: string;
  variations: AltVariation[];
  issue?: 'missing' | 'too_short' | 'too_long' | 'generic' | 'keyword_stuffed';
  injected: boolean;
}

export interface Alt12QualityReport {
  total: number;
  decorative: number;
  valid: number;
  invalid: number;
  issues: Record<string, number>;
}

export interface Alt12Output {
  results: AltTextResult[];
  qualityReport: Alt12QualityReport;
  injected: boolean;
}

export const ALT_LENGTH = { min: 50, max: 125 } as const;
export const ALT12_BATCH_SIZE = 30;

export const IMAGE_TYPE_PATTERNS: Record<ImageType, string[]> = {
  product:    ['product', 'produit', 'shop', 'item', 'article'],
  team:       ['team', 'equipe', 'staff', 'people', 'portrait', 'avatar'],
  ui:         ['screenshot', 'interface', 'dashboard', 'screen', 'app', 'ui'],
  hero:       ['hero', 'banner', 'cover', 'header', 'background'],
  blog:       ['blog', 'article', 'post', 'content'],
  decorative: ['icon', 'logo', 'decoration', 'pattern', 'bg', 'separator'],
};
