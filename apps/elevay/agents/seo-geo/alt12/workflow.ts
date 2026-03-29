import { GracefulFallback } from '../../../core/types';
import { getKeywordData } from '../../../core/tools/dataForSeo';
import {
  Alt12Inputs,
  ImageContext,
  AltVariation,
  AltTextResult,
  Alt12QualityReport,
  ImageType,
  ALT_LENGTH,
  IMAGE_TYPE_PATTERNS,
} from './types';

const FALLBACKS: GracefulFallback[] = [
  {
    missingTool: 'dataForSeo',
    fallbackBehavior: 'Mots-clés extraits du nom de fichier ou du titre de page',
    degradedOutput: 'Mots-clés moins précis — volumes non disponibles',
  },
  {
    missingTool: 'visionApi',
    fallbackBehavior: 'Description basée sur contexte de page uniquement',
    degradedOutput: 'Images sans contexte de page non décrites visuellement',
  },
  {
    missingTool: 'cms',
    fallbackBehavior: 'Export CSV uniquement',
    degradedOutput: 'Injection CMS non disponible — export manuel requis',
  },
];

export function detectImageType(
  imageUrl: string,
  pageUrl: string,
  filename: string,
): ImageType {
  const combined = `${imageUrl} ${pageUrl} ${filename}`.toLowerCase();
  for (const [type, patterns] of Object.entries(IMAGE_TYPE_PATTERNS) as [ImageType, string[]][]) {
    if (patterns.some((p) => combined.includes(p))) return type;
  }
  return 'blog';
}

export async function fetchImageKeyword(
  pageUrl: string,
  imageType: ImageType,
  providedKeywords: Record<string, string[]> | undefined,
  language: string,
): Promise<string> {
  if (imageType === 'decorative') return '';
  if (providedKeywords?.[pageUrl]?.[0]) return providedKeywords[pageUrl][0];
  try {
    const slug = pageUrl.split('/').filter(Boolean).pop() ?? '';
    const seed = slug.replace(/-/g, ' ');
    const data = await getKeywordData([seed], language);
    return data[0]?.keyword ?? seed;
  } catch {
    return pageUrl.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') ?? '';
  }
}

export function generateAltVariation(
  context: ImageContext,
  variantIndex: number,
): AltVariation {
  if (context.imageType === 'decorative') {
    return {
      text: '',
      charCount: 0,
      hasKeyword: false,
      wcagCompliant: true,
      valid: true,
    };
  }

  const templates = buildAltTemplates(context);
  const raw = templates[variantIndex % templates.length] ?? templates[0] ?? '';
  const text = truncateToLength(raw, ALT_LENGTH.min, ALT_LENGTH.max);

  return {
    text,
    charCount: text.length,
    hasKeyword:
      context.targetKeyword.length > 0 &&
      text.toLowerCase().includes(context.targetKeyword.toLowerCase()),
    wcagCompliant: !isKeywordStuffed(text, context.targetKeyword),
    valid: validateAlt(text, context.targetKeyword),
  };
}

export function detectAltIssue(
  current: string,
  imageType: ImageType,
): AltTextResult['issue'] | undefined {
  if (imageType === 'decorative') return undefined;
  if (!current || current.trim() === '') return 'missing';
  if (current.length < 10) return 'too_short';
  if (current.length > 150) return 'too_long';
  if (['image', 'photo', 'img', 'picture'].includes(current.toLowerCase().trim())) return 'generic';
  if (isKeywordStuffed(current, '')) return 'keyword_stuffed';
  return undefined;
}

export async function processImageBatch(
  images: ImageContext[],
  inputs: Alt12Inputs,
): Promise<AltTextResult[]> {
  const results: AltTextResult[] = [];

  for (const image of images) {
    const variations: AltVariation[] = [];
    for (let i = 0; i < inputs.variationsCount; i++) {
      variations.push(generateAltVariation(image, i));
    }

    results.push({
      imageUrl: image.url,
      pageUrl: image.pageUrl,
      imageType: image.imageType,
      targetKeyword: image.targetKeyword,
      variations,
      issue: detectAltIssue(image.currentAlt, image.imageType),
      injected: false,
    });
  }

  return results;
}

export function buildQualityReport(results: AltTextResult[]): Alt12QualityReport {
  const issues: Record<string, number> = {};
  let valid = 0;
  let decorative = 0;

  for (const r of results) {
    if (r.imageType === 'decorative') {
      decorative++;
      valid++;
      continue;
    }
    const hasValidVariation = r.variations.some((v) => v.valid);
    if (hasValidVariation) valid++;
    if (r.issue) {
      issues[r.issue] = (issues[r.issue] ?? 0) + 1;
    }
  }

  return {
    total: results.length,
    decorative,
    valid,
    invalid: results.length - valid,
    issues,
  };
}

// — helpers —

function buildAltTemplates(context: ImageContext): string[] {
  const kw = context.targetKeyword;
  const page = context.pageTitle;

  const byType: Record<ImageType, string[]> = {
    product:    [
      `${kw} — vue détaillée du produit`,
      `Produit ${kw} présenté sur ${page}`,
    ],
    team:       [
      `Membre de l'équipe ${page}`,
      `Portrait d'un collaborateur — ${page}`,
    ],
    ui:         [
      `Interface ${kw} — capture d'écran de la fonctionnalité`,
      `Dashboard ${kw} illustrant ${page}`,
    ],
    hero:       [
      `${kw} — image principale de la page ${page}`,
      `Illustration hero pour ${page} — ${kw}`,
    ],
    blog:       [
      `Illustration de l'article : ${kw}`,
      `${page} — image d'illustration ${kw}`,
    ],
    decorative: [''],
  };

  return byType[context.imageType];
}

function truncateToLength(text: string, min: number, max: number): string {
  if (text.length <= max) return text;
  const truncated = text.slice(0, max - 1);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > min ? truncated.slice(0, lastSpace) : truncated;
}

function isKeywordStuffed(text: string, keyword: string): boolean {
  if (!keyword) return false;
  const occurrences = (
    text.toLowerCase().match(new RegExp(keyword.toLowerCase(), 'g')) ?? []
  ).length;
  return occurrences > 2;
}

function validateAlt(text: string, keyword: string): boolean {
  if (text.length < ALT_LENGTH.min || text.length > ALT_LENGTH.max) return false;
  if (keyword && !text.toLowerCase().includes(keyword.toLowerCase())) return false;
  if (isKeywordStuffed(text, keyword)) return false;
  return true;
}

export { FALLBACKS };
