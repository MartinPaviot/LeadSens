import { AgentContext, AgentSession } from '../../../core/types';
import { Bsw10Inputs, Bsw10Output } from './types';
import {
  fetchKeywordsAndPaa,
  benchmarkCompetitors,
  buildArticleStructure,
  buildClusterArchitecture,
  buildEditorialCalendar,
} from './workflow';
import { BSW10_SYSTEM_PROMPT } from './prompt';

export async function activate(
  context: AgentContext,
  inputs: Bsw10Inputs,
  geo = 'FR',
): Promise<AgentSession> {
  const session: AgentSession = {
    sessionId: context.sessionId,
    agentCode: 'AGT-SEO-BSW-10',
    startedAt: new Date(),
    steps: [],
    output: null,
  };

  // Step 1 — Keywords + PAA
  const keywords = await fetchKeywordsAndPaa(inputs, geo);
  session.steps.push({
    id: 'keywords',
    name: 'Mots-clés + PAA',
    status: keywords.length > 0 ? 'done' : 'skipped',
  });

  // Step 2 — Benchmark competitors
  const competitors = await benchmarkCompetitors(keywords[0] ?? inputs.topic, geo);
  session.steps.push({
    id: 'benchmark',
    name: 'Benchmark top 5 concurrents',
    status: competitors.length > 0 ? 'done' : 'skipped',
  });

  // Step 3 — Article structure (requires client validation)
  const articleStructure = buildArticleStructure(inputs, keywords);
  session.steps.push({
    id: 'structure',
    name: 'Structure article H2/H3',
    status: 'done',
  });

  // Step 4 — Body content (stub — LLM call in production)
  const bodyContent = `<!-- Contenu généré par AGT-SEO-BSW-10 pour : ${inputs.topic} (${inputs.articleFormat}) -->`;
  session.steps.push({
    id: 'content',
    name: 'Rédaction article',
    status: 'done',
  });

  // Step 5 — Cluster architecture (mode cluster/calendar)
  let clusterArchitecture: ReturnType<typeof buildClusterArchitecture> | undefined;
  let editorialCalendar: ReturnType<typeof buildEditorialCalendar> | undefined;

  if (inputs.mode === 'cluster' || inputs.mode === 'calendar') {
    clusterArchitecture = buildClusterArchitecture(inputs, keywords);
    session.steps.push({
      id: 'cluster',
      name: 'Architecture Topic Cluster',
      status: 'done',
    });

    if (inputs.mode === 'calendar') {
      editorialCalendar = buildEditorialCalendar(inputs, clusterArchitecture);
      session.steps.push({
        id: 'calendar',
        name: 'Calendrier éditorial',
        status: 'done',
      });
    }
  }

  const wordCount = bodyContent.split(/\s+/).length;

  const output: Bsw10Output = {
    mode: inputs.mode,
    articleStructure,
    bodyContent,
    wordCount,
    clusterArchitecture,
    editorialCalendar,
    exportReady: true,
  };

  session.output = output;
  return session;
}

export { BSW10_SYSTEM_PROMPT };
export * from './types';
