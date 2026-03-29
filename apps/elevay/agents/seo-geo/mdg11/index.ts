import { AgentContext, AgentSession } from '../../../core/types';
import { Mdg11Inputs, Mdg11Output, PageMeta, MetaDescriptionResult } from './types';
import {
  fetchPageKeyword,
  detectPageType,
  processPageBatch,
  buildQualityReport,
} from './workflow';
import { MDG11_SYSTEM_PROMPT } from './prompt';

export async function activate(
  context: AgentContext,
  inputs: Mdg11Inputs,
  pages: { url: string; title: string; currentMeta: string }[],
): Promise<AgentSession> {
  const session: AgentSession = {
    sessionId: context.sessionId,
    agentCode: 'AGT-SEO-MDG-11',
    startedAt: new Date(),
    steps: [],
    output: null,
  };

  if (pages.length === 0) {
    session.output = { error: 'Aucune page fournie — crawl requis avant activation' };
    return session;
  }

  // Step 1 — Enrich pages with pageType + keyword
  const enrichedPages: PageMeta[] = await Promise.all(
    pages.map(async (p) => ({
      url: p.url,
      title: p.title,
      currentMeta: p.currentMeta,
      pageType: detectPageType(p.url),
      targetKeyword: await fetchPageKeyword(p.url, inputs.targetKeywords, inputs.language),
    })),
  );
  session.steps.push({
    id: 'enrich',
    name: 'Enrichissement pages (type + mot-clé)',
    status: 'done',
  });

  // Step 2 — Process in batches of 50
  const BATCH_SIZE = 50;
  const allResults: MetaDescriptionResult[] = [];
  for (let i = 0; i < enrichedPages.length; i += BATCH_SIZE) {
    const batch = enrichedPages.slice(i, i + BATCH_SIZE);
    const batchResults = await processPageBatch(batch, inputs);
    allResults.push(...batchResults);
  }
  session.steps.push({
    id: 'generate',
    name: `Génération metas (${allResults.length} pages)`,
    status: 'done',
  });

  // Step 3 — Quality report
  const qualityReport = buildQualityReport(allResults);
  session.steps.push({
    id: 'quality',
    name: 'Rapport qualité',
    status: 'done',
  });

  const output: Mdg11Output = {
    results: allResults,
    qualityReport,
    injected: false,
  };

  session.output = output;
  return session;
}

export { MDG11_SYSTEM_PROMPT };
export * from './types';
