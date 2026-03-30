import { tsi07InputSchema } from '../schemas';
import { AgentContext, AgentSession } from '../../../core/types';
import { Tsi07Inputs, Tsi07Output } from './types';
import { runCrawl, fetchGscData, classifyIssues, buildActionPlan, buildReport, pushTsi07Corrections } from './workflow';
import { TSI07_SYSTEM_PROMPT } from './prompt';
import type { WordPressCredentials } from '../../../core/tools/cms/wordpress';
import type { HubSpotCredentials } from '../../../core/tools/cms/hubspot';
import type { ShopifyCredentials } from '../../../core/tools/cms/shopify';
import type { WebflowCredentials } from '../../../core/tools/cms/webflow';

export async function activate(
  context: AgentContext,
  inputs: Tsi07Inputs,
  wpCredentials?: WordPressCredentials,
  hubCreds?: HubSpotCredentials,
  shopifyCreds?: ShopifyCredentials,
  webflowCreds?: WebflowCredentials,
): Promise<AgentSession> {
  tsi07InputSchema.parse(inputs);
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

  session.steps.push({ id: 'classify', name: 'Issue classification', status: 'done' });
  session.steps.push({ id: 'report', name: 'Report generation', status: 'done' });

  // Step 5 — Push corrections to CMS
  const correctionsPush = await pushTsi07Corrections(
    issues,
    inputs.automationLevel,
    inputs.cmsType,
    wpCredentials,
    hubCreds,
    shopifyCreds,
    webflowCreds,
  );
  if (correctionsPush.applied.length > 0 || correctionsPush.pending.length > 0) {
    session.steps.push({
      id: 'cms_push',
      name: correctionsPush.applied.length > 0
        ? `${correctionsPush.applied.length} corrections appliquées, ${correctionsPush.pending.length} en attente`
        : `${correctionsPush.pending.length} corrections en attente de validation`,
      status: correctionsPush.applied.length > 0 ? 'done' : 'skipped',
    });
  }

  const output: Tsi07Output = {
    report,
    actionPlan,
    correctionsApplied: correctionsPush.applied,
    correctionsPush,
    monitoringActive: false,
  };

  session.output = output;

  return session;
}

export { TSI07_SYSTEM_PROMPT };
export * from './types';
