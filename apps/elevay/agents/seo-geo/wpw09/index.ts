import { AgentContext, AgentSession } from '../../../core/types';
import { Wpw09Inputs, Wpw09PageOutput } from './types';
import { benchmarkSerp, fetchKeywords, buildStructure, buildPageOutput } from './workflow';
import { WPW09_SYSTEM_PROMPT } from './prompt';

export async function activate(
  context: AgentContext,
  inputs: Wpw09Inputs,
  geo = 'FR',
): Promise<AgentSession> {
  const session: AgentSession = {
    sessionId: context.sessionId,
    agentCode: 'AGT-SEO-WPW-09',
    startedAt: new Date(),
    steps: [],
    output: null,
  };

  // Step 1 — Fetch keywords
  const keywords = await fetchKeywords(inputs, geo);
  session.steps.push({
    id: 'keywords',
    name: 'Collecte mots-clés',
    status: keywords.length > 0 ? 'done' : 'skipped',
  });

  // Step 2 — Benchmark SERP
  const serpResults = await benchmarkSerp(keywords, geo);
  session.steps.push({
    id: 'serp',
    name: 'Benchmark SERP top 5',
    status: serpResults.length > 0 ? 'done' : 'skipped',
  });

  // Step 3 — Build structure (requires client validation before content)
  const structure = buildStructure(inputs, keywords, serpResults);
  session.steps.push({
    id: 'structure',
    name: 'Structure H1/H2/H3',
    status: 'done',
  });

  // Step 4 — Content generation (stub — LLM call in production)
  const bodyContent = `<!-- Contenu généré par AGT-SEO-WPW-09 pour : ${inputs.brief} -->`;

  // Step 5 — Assemble output
  const pageOutput = buildPageOutput(inputs, structure, bodyContent);
  session.steps.push({
    id: 'content',
    name: 'Rédaction contenu complet',
    status: 'done',
  });

  session.output = pageOutput satisfies Wpw09PageOutput;
  return session;
}

export { WPW09_SYSTEM_PROMPT };
export * from './types';
