import { GracefulFallback } from '../../../core/types';
import { getKeywordData } from '../../../core/tools/dataForSeo';
import { getSerp, SerpResult } from '../../../core/tools/serpApi';
import { Wpw09Inputs, PageStructure, Wpw09PageOutput, PAGE_WORD_COUNT } from './types';
import { PAGE_TYPE_ANGLES } from './prompt';

const FALLBACKS: GracefulFallback[] = [
  {
    missingTool: 'serpApi',
    fallbackBehavior: 'Benchmark concurrent désactivé — structure basée sur brief uniquement',
    degradedOutput: 'Structure non validée contre les top 5 SERP',
  },
  {
    missingTool: 'dataForSeo',
    fallbackBehavior: 'Mots-clés fournis par le client uniquement',
    degradedOutput: 'Pas de suggestion de mots-clés complémentaires',
  },
];

export async function benchmarkSerp(
  keywords: string[],
  geo: string,
): Promise<SerpResult[]> {
  try {
    const primary = keywords[0];
    if (!primary) return [];
    return await getSerp(primary, geo, 5);
  } catch {
    return [];
  }
}

export async function fetchKeywords(
  inputs: Wpw09Inputs,
  geo: string,
): Promise<string[]> {
  if (inputs.targetKeywords && inputs.targetKeywords.length > 0) {
    return inputs.targetKeywords;
  }
  try {
    const seed = inputs.brief.split(' ').slice(0, 3).join(' ');
    const data = await getKeywordData([seed], geo);
    return data.slice(0, 10).map((k) => k.keyword);
  } catch {
    return [];
  }
}

export function buildStructure(
  inputs: Wpw09Inputs,
  keywords: string[],
  serpResults: SerpResult[],
): PageStructure {
  const primary = keywords[0] ?? '';
  const competitorH2s = serpResults.flatMap((r) => r.h2s ?? []).slice(0, 6);

  const h2s = competitorH2s.length > 0
    ? competitorH2s
    : getDefaultH2s(inputs.pageType, primary);

  const briefWords = inputs.brief.split(' ');

  return {
    metaTitles: [
      `${primary} — ${briefWords.slice(0, 4).join(' ')}`,
      `${briefWords.slice(0, 4).join(' ')} | ${primary}`,
    ],
    metaDescription: `Découvrez ${primary}. ${inputs.brief.slice(0, 100)}. ${getDefaultCta(inputs.pageType)}`,
    h1Options: [
      `${briefWords.slice(0, 6).join(' ')} — ${primary}`,
      `${primary} : ${briefWords.slice(0, 5).join(' ')}`,
    ],
    h2s,
    h3s: Object.fromEntries(h2s.map((h2) => [h2, []])),
  };
}

export function buildPageOutput(
  inputs: Wpw09Inputs,
  structure: PageStructure,
  bodyContent: string,
): Wpw09PageOutput {
  const wordCount = bodyContent.split(/\s+/).length;
  const range = PAGE_WORD_COUNT[inputs.pageType];

  return {
    metaTitle: structure.metaTitles[0] ?? '',
    metaDescription: structure.metaDescription,
    h1: structure.h1Options[0] ?? '',
    structure,
    bodyContent,
    internalLinks: inputs.internalLinksAvailable.slice(0, 5).map((url) => ({
      anchor: url.split('/').filter(Boolean).pop() ?? url,
      url,
    })),
    cta: [getDefaultCta(inputs.pageType)],
    imageRecommendations: [
      {
        description: `Image principale illustrant ${inputs.brief.split(' ').slice(0, 4).join(' ')}`,
        altText: structure.h1Options[0] ?? '',
      },
    ],
    wordCount,
    exportReady: wordCount >= range.min,
  };
}

export function formatAsHtml(output: Wpw09PageOutput): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <title>${output.metaTitle}</title>
  <meta name="description" content="${output.metaDescription}">
</head>
<body>
  <h1>${output.h1}</h1>
  ${output.bodyContent}
</body>
</html>`;
}

export function formatAsMarkdown(output: Wpw09PageOutput): string {
  return `# ${output.h1}\n\n${output.bodyContent}`;
}

// — helpers —

function getDefaultH2s(pageType: Wpw09Inputs['pageType'], primary: string): string[] {
  const defaults: Record<Wpw09Inputs['pageType'], string[]> = {
    about:    ['Notre histoire', 'Notre approche', "Notre équipe", 'Nos valeurs'],
    service:  ['Le problème que nous résolvons', 'Notre solution', 'Comment ça marche', 'Résultats clients'],
    landing:  ['Ce que vous obtenez', 'Comment ça fonctionne', 'Témoignages', 'Commencez maintenant'],
    pillar:   [`Qu'est-ce que ${primary} ?`, 'Les fondamentaux', 'Comment mettre en pratique', 'Aller plus loin'],
    contact:  ['Nous contacter', 'Nos engagements', 'FAQ'],
    category: [`Tout sur ${primary}`, 'Nos produits phares', 'Comment choisir'],
  };
  return defaults[pageType];
}

function getDefaultCta(pageType: Wpw09Inputs['pageType']): string {
  const ctas: Record<Wpw09Inputs['pageType'], string> = {
    about:    'En savoir plus sur notre approche',
    service:  'Demander un devis gratuit',
    landing:  'Commencer maintenant',
    pillar:   'Télécharger le guide complet',
    contact:  'Nous envoyer un message',
    category: 'Voir tous les produits',
  };
  return ctas[pageType];
}

// suppress unused-import warning for PAGE_TYPE_ANGLES (consumed by LLM prompt builder at runtime)
void PAGE_TYPE_ANGLES;

export { FALLBACKS };
