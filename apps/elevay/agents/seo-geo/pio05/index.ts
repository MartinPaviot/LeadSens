import { AgentContext, AgentSession } from '../../../core/types';
import { Pio05Inputs, Pio05Output } from './types';
import {
  buildDualDashboard,
  computeLlmCitabilityScore,
  auditLlmStructure,
  analyzeCompetitors,
  buildRecommendations,
} from './workflow';
import { PIO05_SYSTEM_PROMPT } from './prompt';

export async function activate(
  context: AgentContext,
  inputs: Pio05Inputs,
): Promise<AgentSession> {
  const session: AgentSession = {
    sessionId: context.sessionId,
    agentCode: 'AGT-SEO-PIO-05',
    startedAt: new Date(),
    steps: [],
    output: null,
  };

  // Step 1 — Dual dashboard SEO + GEO
  const dualDashboard = await buildDualDashboard(inputs, context.clientProfile.id);
  session.steps.push({
    id: 'dual_dashboard',
    name: 'Dashboard dual SEO + GEO',
    status: 'done',
  });

  // Step 2 — LLM citability score
  const llmCitabilityScore = computeLlmCitabilityScore(inputs);
  session.steps.push({
    id: 'llm_score',
    name: 'Score citabilité LLM (0-100)',
    status: 'done',
  });

  // Step 3 — LLM structure audit
  const llmStructureAudit = auditLlmStructure(inputs);
  session.steps.push({
    id: 'llm_audit',
    name: 'Audit structure LLM-friendly',
    status: 'done',
  });

  // Step 4 — Competitor intelligence
  const competitorIntelligence = await analyzeCompetitors(inputs);
  session.steps.push({
    id: 'competitors',
    name: `Intelligence concurrentielle (${competitorIntelligence.length} concurrents)`,
    status: 'done',
  });

  // Step 5 — Recommendations
  const { forOpt06, forContent } = buildRecommendations(
    dualDashboard,
    llmCitabilityScore,
    llmStructureAudit,
  );
  session.steps.push({
    id: 'recommendations',
    name: 'Recommandations OPT-06 + contenu',
    status: 'done',
  });

  const output: Pio05Output = {
    dualDashboard,
    llmCitabilityScore,
    llmStructureAudit,
    competitorIntelligence,
    recommendationsForOpt06: forOpt06,
    recommendationsForContent: forContent,
  };

  session.output = output;
  return session;
}

export { PIO05_SYSTEM_PROMPT };
export * from './types';
