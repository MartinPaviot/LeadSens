import { pio05InputSchema } from '../schemas';
import { AgentContext, AgentSession } from '../../../core/types';
import { Pio05Inputs, Pio05Output } from './types';
import {
  buildDualDashboard,
  computeLlmCitabilityScore,
  auditLlmStructure,
  analyzeCompetitors,
  buildRecommendations,
  exportPio05ToSheets,
  generatePio05PdfHtml,
  computeNextRunAt,
} from './workflow';
import { PIO05_SYSTEM_PROMPT } from './prompt';

export async function activate(
  context: AgentContext,
  inputs: Pio05Inputs,
): Promise<AgentSession> {
  pio05InputSchema.parse(inputs);
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
  const llmCitabilityScore = await computeLlmCitabilityScore(inputs, context.clientProfile.id);
  session.steps.push({
    id: 'llm_score',
    name: 'Score citabilité LLM (0-100)',
    status: 'done',
  });

  // Step 3 — LLM structure audit
  const llmStructureAudit = await auditLlmStructure(inputs, context.clientProfile.priorityPages);
  session.steps.push({
    id: 'llm_audit',
    name: `Audit structure LLM-friendly (${llmStructureAudit.pagesAudited} pages)`,
    status: llmStructureAudit.pagesAudited > 0 ? 'done' : 'skipped',
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

  // Step 6 — Exports (PDF + optional Sheets)
  const pdfHtml = generatePio05PdfHtml(
    { dualDashboard, llmCitabilityScore, llmStructureAudit, competitorIntelligence, recommendationsForOpt06: forOpt06, recommendationsForContent: forContent },
    inputs.siteUrl,
  );

  let sheetsUrl: string | undefined;
  try {
    const url = await exportPio05ToSheets(
      { dualDashboard, llmCitabilityScore, llmStructureAudit, competitorIntelligence, recommendationsForOpt06: forOpt06, recommendationsForContent: forContent },
      inputs.siteUrl,
      context.clientProfile.id,
    );
    if (url) sheetsUrl = url;
  } catch {
    // Sheets export failed — non-blocking
  }

  session.steps.push({
    id: 'exports',
    name: sheetsUrl
      ? `Exports : PDF généré + Google Sheets`
      : 'Export : PDF généré',
    status: 'done',
  });

  const nextRunAt = computeNextRunAt(inputs.reportFrequency);

  // Step 7 — Schedule next run via Inngest (only for user-triggered runs)
  if (nextRunAt && context.triggeredBy === 'user') {
    try {
      const { inngest } = await import('../../../src/inngest/client');
      await inngest.send({
        name: 'elevay/agent.report.schedule',
        data: {
          clientId: context.clientProfile.id,
          workspaceId: context.clientProfile.id, // workspaceId resolved at route level
          agentId: 'pio05',
          frequency: inputs.reportFrequency as 'daily' | 'weekly' | 'monthly',
          nextRunAt: nextRunAt.toISOString(),
        },
      });
      session.steps.push({
        id: 'schedule',
        name: `Prochain rapport planifié : ${nextRunAt.toLocaleDateString('fr-FR')}`,
        status: 'done',
      });
    } catch {
      // Inngest scheduling failed — non-blocking
      session.steps.push({
        id: 'schedule',
        name: 'Planification échouée — rapport disponible à la demande',
        status: 'skipped',
      });
    }
  }

  const output: Pio05Output = {
    dualDashboard,
    llmCitabilityScore,
    llmStructureAudit,
    competitorIntelligence,
    recommendationsForOpt06: forOpt06,
    recommendationsForContent: forContent,
    sheetsUrl,
    pdfHtml,
    nextRunAt,
  };

  session.output = output;
  return session;
}

export { PIO05_SYSTEM_PROMPT };
export * from './types';
