import { AgentContext, AgentSession } from '../../../core/types';
import { Tsi07Inputs, Tsi07Output } from './types';
import { runCrawl, fetchGscData, classifyIssues, buildActionPlan, buildReport } from './workflow';
import { TSI07_SYSTEM_PROMPT } from './prompt';

export async function activate(
  context: AgentContext,
  inputs: Tsi07Inputs,
): Promise<AgentSession> {
  const session: AgentSession = {
    sessionId: context.sessionId,
    agentCode: 'AGT-SEO-TSI-07',
    startedAt: new Date(),
    steps: [],
    output: null,
  };

  // Step 1 — Crawl
  const crawlStep = await runCrawl(inputs);
  session.steps.push(crawlStep);

  if (crawlStep.status === 'error') {
    session.output = { error: 'Crawl échoué — DataForSEO indisponible' };
    return session;
  }

  const crawlResults = crawlStep.data ?? [];

  // Step 2 — GSC (optional)
  const gscStep = await fetchGscData(inputs, context.clientProfile.id);
  session.steps.push(gscStep);

  // Step 3 — Classify issues
  const issues = classifyIssues(crawlResults);

  // Step 4 — Build report + action plan
  const report = buildReport(inputs.siteUrl, crawlResults, issues);
  const actionPlan = buildActionPlan(issues);

  const output: Tsi07Output = {
    report,
    actionPlan,
    correctionsApplied: [],
    monitoringActive: false,
  };

  session.steps.push({ id: 'classify', name: 'Classification des problèmes', status: 'done' });
  session.steps.push({ id: 'report', name: 'Génération du rapport', status: 'done' });
  session.output = output;

  return session;
}

export { TSI07_SYSTEM_PROMPT };
export * from './types';
