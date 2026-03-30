import { GracefulFallback } from '../../../core/types';
import { getKeywordData } from '../../../core/tools/dataForSeo';
import { getSerp } from '../../../core/tools/serpApi';
import { semrushGetRelatedKeywords, semrushGetPhraseQuestions } from '../../../core/tools/semrush';
import { isToolConnected } from '../../../core/tools/composio';
import {
  Bsw10Inputs,
  ArticleStructure,
  ClusterArchitecture,
  CalendarEntry,
  SatelliteArticle,
  ARTICLE_WORD_COUNT,
  ArticleFormat,
} from './types';

const FALLBACKS: GracefulFallback[] = [
  {
    missingTool: 'dataForSeo',
    fallbackBehavior: 'Mots-clés fournis par le client uniquement — PAA non disponibles',
    degradedOutput: 'Structure basée sur brief uniquement, sans données SERP',
  },
  {
    missingTool: 'serpApi',
    fallbackBehavior: 'Benchmark concurrent désactivé',
    degradedOutput: 'Longueur et structure non calées sur les top 5 SERP',
  },
];

export async function fetchKeywordsAndPaa(
  inputs: Bsw10Inputs,
  geo: string,
  userId: string,
): Promise<string[]> {
  if (inputs.targetKeywords && inputs.targetKeywords.length > 0) {
    return inputs.targetKeywords;
  }

  let baseKeywords: string[];
  try {
    const seed = inputs.topic.split(' ').slice(0, 3).join(' ');
    const data = await getKeywordData([seed], geo);
    baseKeywords = data.slice(0, 10).map((k) => k.keyword);
  } catch {
    baseKeywords = [inputs.topic];
  }

  // Enrich with SEMrush related keywords + PAA questions if connected
  const semrushConnected = await isToolConnected('semrush', userId);

  if (semrushConnected) {
    try {
      const [related, questions] = await Promise.allSettled([
        semrushGetRelatedKeywords(inputs.topic, geo, userId, 10),
        semrushGetPhraseQuestions(inputs.topic, geo, userId, 10),
      ]);

      if (related.status === 'fulfilled') {
        for (const kw of related.value.map((k) => k.keyword)) {
          if (!baseKeywords.includes(kw)) baseKeywords.push(kw);
        }
      }

      if (questions.status === 'fulfilled') {
        for (const q of questions.value) {
          if (!baseKeywords.includes(q)) baseKeywords.push(q);
        }
      }
    } catch {
      // SEMrush enrichment failed — keep DataForSEO keywords
    }
  }

  return baseKeywords;
}

export async function benchmarkCompetitors(keyword: string, geo: string) {
  try {
    return await getSerp(keyword, geo, 5);
  } catch {
    return [];
  }
}

export function buildArticleStructure(
  inputs: Bsw10Inputs,
  keywords: string[],
): ArticleStructure {
  const primary = keywords[0] ?? inputs.topic;
  const range = ARTICLE_WORD_COUNT[inputs.articleFormat];

  return {
    titleOptions: [
      buildTitle(inputs.articleFormat, primary, 'A'),
      buildTitle(inputs.articleFormat, primary, 'B'),
      buildTitle(inputs.articleFormat, primary, 'C'),
    ],
    h2s: getDefaultH2s(inputs.articleFormat, primary),
    h3s: {},
    estimatedWordCount: Math.round((range.min + range.max) / 2),
  };
}

export function buildClusterArchitecture(
  inputs: Bsw10Inputs,
  keywords: string[],
): ClusterArchitecture {
  const satellites: SatelliteArticle[] = keywords.slice(1, 8).map((kw, i) => ({
    topic: kw,
    format: pickSatelliteFormat(i),
    targetKeyword: kw,
    estimatedWordCount: 1200,
    publishOrder: i + 2,
  }));

  return {
    pillarTopic: inputs.topic,
    pillarWordCount: 3000,
    satellites,
    internalLinkingLogic:
      'Pilier → tous les satellites (liens contextuels H2). Chaque satellite → pilier (lien CTA final) + 2 satellites thématiquement proches.',
  };
}

export function buildEditorialCalendar(
  inputs: Bsw10Inputs,
  cluster: ClusterArchitecture,
): CalendarEntry[] {
  const duration = inputs.calendarDuration ?? 90;
  const totalArticles = cluster.satellites.length + 1;
  const intervalDays = Math.floor(duration / totalArticles);
  const startDate = new Date();

  const entries: CalendarEntry[] = [
    {
      publishDate: formatDate(startDate),
      topic: cluster.pillarTopic,
      format: 'guide',
      targetKeyword: inputs.topic,
      status: 'planned',
    },
  ];

  cluster.satellites.forEach((sat, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + intervalDays * (i + 1));
    entries.push({
      publishDate: formatDate(date),
      topic: sat.topic,
      format: sat.format,
      targetKeyword: sat.targetKeyword,
      status: 'planned',
    });
  });

  return entries;
}

// — helpers —

function buildTitle(format: ArticleFormat, keyword: string, variant: 'A' | 'B' | 'C'): string {
  const templates: Record<ArticleFormat, string[]> = {
    guide:        [`Guide complet : ${keyword}`, `Tout savoir sur ${keyword}`, `${keyword} : le guide 2025`],
    list:         [`Les 10 meilleures ${keyword}`, `Top ${keyword} : notre sélection`, `${keyword} : 10 options comparées`],
    'case-study': [`Comment nous avons réussi avec ${keyword}`, `${keyword} : étude de cas`, `Résultats concrets avec ${keyword}`],
    comparison:   [`${keyword} : comparatif complet`, `Quelle ${keyword} choisir ?`, `${keyword} vs alternatives : le guide`],
    opinion:      [`Pourquoi ${keyword} change tout`, `${keyword} : notre point de vue`, `Ce que personne ne dit sur ${keyword}`],
    tutorial:     [`Comment utiliser ${keyword} (pas à pas)`, `${keyword} : tutoriel complet`, `Maîtriser ${keyword} en 5 étapes`],
    glossary:     [`${keyword} : définition et exemples`, `Qu'est-ce que ${keyword} ?`, `${keyword} expliqué simplement`],
  };
  const idx = variant === 'A' ? 0 : variant === 'B' ? 1 : 2;
  return templates[format][idx] ?? `${keyword} — ${format}`;
}

function getDefaultH2s(format: ArticleFormat, keyword: string): string[] {
  const defaults: Record<ArticleFormat, string[]> = {
    guide:        [`Qu'est-ce que ${keyword} ?`, 'Les fondamentaux à connaître', 'Comment mettre en pratique', 'Erreurs à éviter', 'Aller plus loin'],
    list:         ['Notre méthodologie de sélection', 'Le comparatif complet', 'Notre verdict', 'FAQ'],
    'case-study': ['Le contexte', 'Le problème à résoudre', 'La solution mise en place', 'Les résultats', 'Les enseignements'],
    comparison:   ['Les critères de comparaison', 'Tableau comparatif', 'Analyse détaillée', 'Notre recommandation'],
    opinion:      ['Le constat', 'Notre analyse', 'Les arguments', 'Conclusion et prise de position'],
    tutorial:     ['Prérequis', 'Étape 1', 'Étape 2', 'Étape 3', 'Résultat attendu', 'Problèmes fréquents'],
    glossary:     [`Définition de ${keyword}`, 'Exemples concrets', 'À ne pas confondre avec', 'Pour aller plus loin'],
  };
  return defaults[format];
}

function pickSatelliteFormat(index: number): ArticleFormat {
  const rotation: ArticleFormat[] = ['guide', 'list', 'tutorial', 'comparison', 'glossary', 'case-study', 'opinion'];
  return rotation[index % rotation.length];
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

export { FALLBACKS };
