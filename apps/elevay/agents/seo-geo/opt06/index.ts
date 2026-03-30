import { opt06InputSchema } from '../schemas';
import { AgentContext, AgentSession } from '../../../core/types';
import type { WordPressCredentials } from '../../../core/tools/cms/wordpress';
import type { HubSpotCredentials } from '../../../core/tools/cms/hubspot';
import type { ShopifyCredentials } from '../../../core/tools/cms/shopify';
import type { WebflowCredentials } from '../../../core/tools/cms/webflow';
import { Opt06Inputs, Opt06Output, PageRanking } from './types';
import {
  auditRankings,
  scoreOpportunities,
  applyAutoCorrections,
  enrichCorrectionsWithLlm,
  pushCorrections,
  detectAlerts,
} from './workflow';
import { OPT06_SYSTEM_PROMPT } from './prompt';

export async function activate(
  context: AgentContext,
  inputs: Opt06Inputs,
  previousRankings: PageRanking[] = [],
  wpCredentials?: WordPressCredentials,
  hubCreds?: HubSpotCredentials,
  shopifyCreds?: ShopifyCredentials,
  webflowCreds?: WebflowCredentials,
): Promise<AgentSession> {
  opt06InputSchema.parse(inputs);
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

  // Step 3 — Build correction list
  let correctionsApplied = applyAutoCorrections(opportunities, inputs.automationLevel);
  if (inputs.automationLevel !== 'audit') {
    session.steps.push({
      id: 'apply_corrections',
      name: `Corrections identifiées (${correctionsApplied.length})`,
      status: 'done',
    });
  }

  // Step 3b — Enrich meta corrections with LLM-generated values
  if (correctionsApplied.length > 0 && inputs.automationLevel !== 'audit') {
    correctionsApplied = await enrichCorrectionsWithLlm(correctionsApplied);
  }

  // Step 4 — Push corrections to CMS
  const correctionsPush = await pushCorrections(
    correctionsApplied,
    inputs.automationLevel,
    context.clientProfile.cmsType,
    wpCredentials,
    hubCreds,
    shopifyCreds,
    webflowCreds,
  );
  const pushApplied = correctionsPush.applied.length;
  const pushPending = correctionsPush.pending.length;
  const pushFailed = correctionsPush.failed.length;
  if (correctionsApplied.length > 0) {
    session.steps.push({
      id: 'push_corrections',
      name: pushApplied > 0
        ? `CMS push : ${pushApplied} appliquées, ${pushPending} en attente${pushFailed > 0 ? `, ${pushFailed} échouées` : ''}`
        : correctionsPush.csvExport
          ? `Export CSV (${correctionsApplied.length} corrections)`
          : `${pushPending} corrections en attente de validation`,
      status: pushApplied > 0 ? 'done' : 'skipped',
    });
  }

  // Step 5 — Detect alerts vs previous snapshot
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
    correctionsPush,
    alerts,
    monitoringActive: true,
  };

  session.output = output;
  return session;
}

export { OPT06_SYSTEM_PROMPT };
export * from './types';
