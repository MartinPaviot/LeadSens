import { AgentContext, AgentSession } from '../../../core/types';
import { Opt06Inputs, Opt06Output, PageRanking } from './types';
import {
  auditRankings,
  scoreOpportunities,
  applyAutoCorrections,
  detectAlerts,
} from './workflow';
import { OPT06_SYSTEM_PROMPT } from './prompt';

export async function activate(
  context: AgentContext,
  inputs: Opt06Inputs,
  previousRankings: PageRanking[] = [],
): Promise<AgentSession> {
  const session: AgentSession = {
    sessionId: context.sessionId,
    agentCode: 'AGT-SEO-OPT-06',
    startedAt: new Date(),
    steps: [],
    output: null,
  };

  // Step 1 — Audit rankings
  const rankings = await auditRankings(inputs, context.clientProfile.id);
  session.steps.push({
    id: 'audit_rankings',
    name: 'Audit ranking actuel',
    status: rankings.length > 0 ? 'done' : 'error',
  });

  if (rankings.length === 0) {
    session.output = { error: 'Aucune donnée de ranking disponible' };
    return session;
  }

  // Step 2 — Score opportunities
  const opportunities = scoreOpportunities(rankings, inputs);
  session.steps.push({
    id: 'score_opportunities',
    name: 'Scoring Impact/Effort',
    status: 'done',
  });

  // Step 3 — Apply corrections (semi-auto or full-auto)
  const correctionsApplied = applyAutoCorrections(opportunities, inputs.automationLevel);
  if (inputs.automationLevel !== 'audit') {
    session.steps.push({
      id: 'apply_corrections',
      name: `Corrections appliquées (${correctionsApplied.length})`,
      status: 'done',
    });
  }

  // Step 4 — Detect alerts vs previous snapshot
  const alerts = detectAlerts(rankings, previousRankings);
  session.steps.push({
    id: 'alerts',
    name: `Alertes détectées (${alerts.length})`,
    status: 'done',
  });

  const output: Opt06Output = {
    rankings,
    opportunities,
    correctionsApplied,
    alerts,
    monitoringActive: true,
  };

  session.output = output;
  return session;
}

export { OPT06_SYSTEM_PROMPT };
export * from './types';
