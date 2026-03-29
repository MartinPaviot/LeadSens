import { AgentContext, AgentSession } from '../../../core/types';
import { Alt12Inputs, Alt12Output, AltTextResult, ImageContext } from './types';
import {
  detectImageType,
  fetchImageKeyword,
  processImageBatch,
  buildQualityReport,
} from './workflow';
import { ALT12_SYSTEM_PROMPT } from './prompt';

export async function activate(
  context: AgentContext,
  inputs: Alt12Inputs,
  images: { url: string; pageUrl: string; pageTitle: string; currentAlt: string; filename: string }[],
): Promise<AgentSession> {
  const session: AgentSession = {
    sessionId: context.sessionId,
    agentCode: 'AGT-SEO-ALT-12',
    startedAt: new Date(),
    steps: [],
    output: null,
  };

  if (images.length === 0) {
    session.output = { error: 'Aucune image fournie — crawl requis avant activation' };
    return session;
  }

  // Step 1 — Classify images + fetch keywords
  const enrichedImages: ImageContext[] = await Promise.all(
    images.map(async (img) => {
      const imageType = detectImageType(img.url, img.pageUrl, img.filename);
      const targetKeyword = await fetchImageKeyword(
        img.pageUrl,
        imageType,
        inputs.targetKeywords,
        inputs.language,
      );
      return {
        url: img.url,
        pageUrl: img.pageUrl,
        pageTitle: img.pageTitle,
        currentAlt: img.currentAlt,
        imageType,
        targetKeyword,
        filename: img.filename,
      };
    }),
  );
  session.steps.push({
    id: 'classify',
    name: 'Classification images + mots-clés',
    status: 'done',
  });

  // Step 2 — Process in batches of 30
  const BATCH_SIZE = 30;
  const allResults: AltTextResult[] = [];
  for (let i = 0; i < enrichedImages.length; i += BATCH_SIZE) {
    const batch = enrichedImages.slice(i, i + BATCH_SIZE);
    const batchResults = await processImageBatch(batch, inputs);
    allResults.push(...batchResults);
  }
  session.steps.push({
    id: 'generate',
    name: `Génération ALT texts (${allResults.length} images)`,
    status: 'done',
  });

  // Step 3 — Quality report
  const qualityReport = buildQualityReport(allResults);
  session.steps.push({
    id: 'quality',
    name: 'Rapport qualité WCAG + SEO',
    status: 'done',
  });

  const output: Alt12Output = {
    results: allResults,
    qualityReport,
    injected: false,
  };

  session.output = output;
  return session;
}

export { ALT12_SYSTEM_PROMPT };
export * from './types';
