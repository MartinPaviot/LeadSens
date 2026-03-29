import { GracefulFallback } from '../../../core/types';
import { getKeywordData } from '../../../core/tools/dataForSeo';
import { getSerp } from '../../../core/tools/serpApi';
import {
  Mdg11Inputs,
  PageMeta,
  MetaVariation,
  MetaDescriptionResult,
  QualityReport,
  MetaPageType,
  META_LENGTH,
  PAGE_TYPE_CTA,
  PAGE_TYPE_TONE,
} from './types';

const FALLBACKS: GracefulFallback[] = [
  {
    missingTool: 'dataForSeo',
    fallbackBehavior: 'Mots-clés fournis par le client ou extraits du titre de la page',
    degradedOutput: 'Mots-clés moins précis — volumes non disponibles',
  },
  {
    missingTool: 'serpApi',
    fallbackBehavior: 'Benchmark concurrent désactivé',
    degradedOutput: 'Metas générées sans référence aux concurrents',
  },
  {
    missingTool: 'cms',
    fallbackBehavior: 'Export CSV uniquement',
    degradedOutput: 'Injection CMS non disponible — export manuel requis',
  },
];

const GENERIC_PATTERNS = [
  'bienvenue sur notre site',
  'découvrez nos produits',
  'en savoir plus sur',
];

// suppress unused-import lint for PAGE_TYPE_TONE (used by LLM prompt builder at runtime)
void PAGE_TYPE_TONE;
// suppress unused-import lint for getSerp (used by competitor benchmark — real impl pending)
void getSerp;

export async function fetchPageKeyword(
  url: string,
  providedKeywords: Record<string, string[]> | undefined,
  language: string,
): Promise<string> {
  if (providedKeywords?.[url]?.[0]) {
    return providedKeywords[url][0];
  }
  try {
    const slug = url.split('/').filter(Boolean).pop() ?? '';
    const seed = slug.replace(/-/g, ' ');
    const data = await getKeywordData([seed], language);
    return data[0]?.keyword ?? seed;
  } catch {
    return url.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') ?? '';
  }
}

export function detectPageType(url: string): MetaPageType {
  const path = url.toLowerCase();
  if (path === '/' || path.endsWith('/home')) return 'homepage';
  if (path.includes('/blog') || path.includes('/article')) return 'blog';
  if (path.includes('/product') || path.includes('/produit')) return 'product';
  if (path.includes('/category') || path.includes('/categorie')) return 'category';
  if (path.includes('/about') || path.includes('/propos') || path.includes('/contact')) return 'about';
  return 'service';
}

export function generateMetaVariation(
  keyword: string,
  pageType: MetaPageType,
  brandTone: string,
  title: string,
  variantIndex: number,
): MetaVariation {
  const cta = PAGE_TYPE_CTA[pageType];
  const templates = buildTemplates(keyword, pageType, cta, title);
  const raw = templates[variantIndex % templates.length] ?? templates[0];
  const text = truncateToLength(raw ?? '', META_LENGTH.min, META_LENGTH.max);

  return {
    text,
    charCount: text.length,
    hasCta: text.toLowerCase().includes(cta.toLowerCase().split(' ')[0] ?? ''),
    hasKeyword: text.toLowerCase().includes(keyword.toLowerCase()),
    valid: validateMeta(text, keyword),
  };
}

export function detectIssue(
  current: string,
  generated: MetaVariation,
): MetaDescriptionResult['issue'] | undefined {
  if (!current || current.trim() === '') return 'missing';
  if (current.length < 100) return 'too_short';
  if (current.length > 165) return 'too_long';
  if (GENERIC_PATTERNS.some((p) => current.toLowerCase().includes(p))) return 'generic';
  return undefined;
}

export function buildQualityReport(results: MetaDescriptionResult[]): QualityReport {
  const issues: Record<string, number> = {};
  let valid = 0;

  for (const r of results) {
    const hasValidVariation = r.variations.some((v) => v.valid);
    if (hasValidVariation) {
      valid++;
    }
    if (r.issue) {
      issues[r.issue] = (issues[r.issue] ?? 0) + 1;
    }
  }

  return {
    total: results.length,
    valid,
    invalid: results.length - valid,
    issues,
  };
}

export async function processPageBatch(
  pages: PageMeta[],
  inputs: Mdg11Inputs,
): Promise<MetaDescriptionResult[]> {
  const results: MetaDescriptionResult[] = [];

  for (const page of pages) {
    const variations: MetaVariation[] = [];
    for (let i = 0; i < inputs.variationsCount; i++) {
      variations.push(
        generateMetaVariation(
          page.targetKeyword,
          page.pageType,
          inputs.brandTone,
          page.title,
          i,
        ),
      );
    }

    results.push({
      url: page.url,
      pageType: page.pageType,
      targetKeyword: page.targetKeyword,
      variations,
      issue: detectIssue(page.currentMeta, variations[0]!),
      injected: false,
    });
  }

  return results;
}

// — helpers —

function buildTemplates(
  keyword: string,
  pageType: MetaPageType,
  cta: string,
  title: string,
): string[] {
  return [
    `${keyword} — ${title}. ${cta} et découvrez comment nous pouvons vous aider.`,
    `Vous cherchez ${keyword} ? ${title}. ${cta} dès maintenant.`,
    `${title} : la solution ${keyword} qu'il vous faut. ${cta} pour en savoir plus.`,
  ];
}

function truncateToLength(text: string, min: number, max: number): string {
  if (text.length <= max) return text;
  const truncated = text.slice(0, max - 1);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > min ? truncated.slice(0, lastSpace) + '.' : truncated + '.';
}

function validateMeta(text: string, keyword: string): boolean {
  if (text.length < META_LENGTH.min || text.length > META_LENGTH.max) return false;
  if (!text.toLowerCase().includes(keyword.toLowerCase())) return false;
  if (GENERIC_PATTERNS.some((p) => text.toLowerCase().includes(p))) return false;
  return true;
}

export { FALLBACKS };
