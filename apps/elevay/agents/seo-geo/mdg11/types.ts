export type MetaPageType =
  | 'homepage'
  | 'service'
  | 'blog'
  | 'category'
  | 'product'
  | 'about';

export type MetaTone =
  | 'inspiring'
  | 'persuasive'
  | 'informative'
  | 'practical'
  | 'specific'
  | 'human';

export interface Mdg11Inputs {
  siteUrl: string;
  scope: 'all' | 'blog' | 'products' | string[];
  cmsType: 'wordpress' | 'hubspot' | 'shopify' | 'webflow' | 'other';
  brandTone: string;
  targetKeywords?: Record<string, string[]>;
  variationsCount: 1 | 2 | 3;
  language: string;
  inject: boolean;
}

export interface PageMeta {
  url: string;
  currentMeta: string;
  pageType: MetaPageType;
  targetKeyword: string;
  title: string;
}

export interface MetaVariation {
  text: string;
  charCount: number;
  hasCta: boolean;
  hasKeyword: boolean;
  valid: boolean;
}

export interface MetaDescriptionResult {
  url: string;
  pageType: MetaPageType;
  targetKeyword: string;
  variations: MetaVariation[];
  issue?: 'missing' | 'too_short' | 'too_long' | 'duplicate' | 'generic';
  injected: boolean;
}

export interface QualityReport {
  total: number;
  valid: number;
  invalid: number;
  issues: Record<string, number>;
}

export interface Mdg11Output {
  results: MetaDescriptionResult[];
  qualityReport: QualityReport;
  injected: boolean;
}

export const META_LENGTH = { min: 155, max: 160 } as const;

export const MDG11_BATCH_SIZE = 50;

export const PAGE_TYPE_CTA: Record<MetaPageType, string> = {
  homepage: 'Découvrez',
  service:  'Demandez un devis',
  blog:     "Lisez l'article",
  category: 'Voir la sélection',
  product:  'Voir les détails',
  about:    'En savoir plus',
};

export const PAGE_TYPE_TONE: Record<MetaPageType, MetaTone> = {
  homepage: 'inspiring',
  service:  'persuasive',
  blog:     'informative',
  category: 'practical',
  product:  'specific',
  about:    'human',
};
