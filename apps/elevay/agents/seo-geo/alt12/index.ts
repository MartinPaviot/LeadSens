import { alt12InputSchema } from '../schemas';
import { AgentContext, AgentSession } from '../../../core/types';
import { Alt12Inputs, Alt12Output, AltTextResult, ImageContext, ALT12_BATCH_SIZE } from './types';
import {
  detectImageType,
  fetchImageKeyword,
  processImageBatch,
  buildQualityReport,
} from './workflow';
import { ALT12_SYSTEM_PROMPT } from './prompt';
import {
  wpGetImages,
  wpUpdateImageAlt,
  type WordPressCredentials,
} from '../../../core/tools/cms/wordpress';
import {
  hubGetFileMap,
  hubUpdateImageAlt,
  type HubSpotCredentials,
} from '../../../core/tools/cms/hubspot';
import {
  shopifyGetImageMap,
  shopifyUpdateImageAlt,
  type ShopifyCredentials,
} from '../../../core/tools/cms/shopify';
import {
  webflowGetImageMap,
  webflowUpdateImageAlt,
  type WebflowCredentials,
} from '../../../core/tools/cms/webflow';

export async function activate(
  context: AgentContext,
  inputs: Alt12Inputs,
  images: { url: string; pageUrl: string; pageTitle: string; currentAlt: string; filename: string }[],
  wpCredentials?: WordPressCredentials,
  hubCreds?: HubSpotCredentials,
  shopifyCreds?: ShopifyCredentials,
  webflowCreds?: WebflowCredentials,
): Promise<AgentSession> {
  alt12InputSchema.parse(inputs);
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

  // Step 2 — Process in batches
  const BATCH_SIZE = ALT12_BATCH_SIZE;
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

  // Step 4 — CMS injection (if enabled and not audit mode)
  let injectedCount = 0;
  if (inputs.inject && context.clientProfile.automationLevel !== 'audit') {
    if (inputs.cmsType === 'wordpress' && wpCredentials) {
      try {
        const wpImages = await wpGetImages(wpCredentials, 100);
        const urlToMediaId = new Map<string, number>();
        for (const img of wpImages) urlToMediaId.set(img.url.toLowerCase(), img.id);

        for (const result of allResults) {
          if (result.imageType === 'decorative') continue;
          const best = result.variations.find((v) => v.valid);
          if (!best) continue;
          const mediaId = urlToMediaId.get(result.imageUrl.toLowerCase());
          if (mediaId === undefined) continue;
          try {
            await wpUpdateImageAlt(wpCredentials, mediaId, best.text);
            result.injected = true;
            injectedCount++;
          } catch {
            // skip — non-blocking
          }
        }
      } catch {
        // WordPress unreachable
      }
    } else if (inputs.cmsType === 'hubspot' && hubCreds) {
      try {
        const fileMap = await hubGetFileMap(hubCreds);

        for (const result of allResults) {
          if (result.imageType === 'decorative') continue;
          const best = result.variations.find((v) => v.valid);
          if (!best) continue;
          // Match by full URL or filename (last segment)
          const filename = result.imageUrl.split('/').pop()?.toLowerCase() ?? '';
          const fileId = fileMap.get(result.imageUrl.toLowerCase()) ?? fileMap.get(filename);
          if (!fileId) continue;
          try {
            await hubUpdateImageAlt(hubCreds, fileId, best.text);
            result.injected = true;
            injectedCount++;
          } catch {
            // skip — non-blocking
          }
        }
      } catch {
        // HubSpot unreachable
      }
    } else if (inputs.cmsType === 'shopify' && shopifyCreds) {
      try {
        const imageMap = await shopifyGetImageMap(shopifyCreds);

        for (const result of allResults) {
          if (result.imageType === 'decorative') continue;
          const best = result.variations.find((v) => v.valid);
          if (!best) continue;
          const entry = imageMap.get(result.imageUrl.toLowerCase().replace(/\/+$/, ''));
          if (!entry) continue;
          try {
            await shopifyUpdateImageAlt(shopifyCreds, entry.productId, entry.imageId, best.text);
            result.injected = true;
            injectedCount++;
          } catch {
            // skip — non-blocking
          }
        }
      } catch {
        // Shopify unreachable
      }
    } else if (inputs.cmsType === 'webflow' && webflowCreds) {
      try {
        const imageMap = await webflowGetImageMap(webflowCreds);

        for (const result of allResults) {
          if (result.imageType === 'decorative') continue;
          const best = result.variations.find((v) => v.valid);
          if (!best) continue;
          // Match by full URL or filename
          const filename = result.imageUrl.split('/').pop()?.toLowerCase() ?? '';
          const assetId = imageMap.get(result.imageUrl.toLowerCase().replace(/\/+$/, '')) ?? imageMap.get(filename);
          if (!assetId) continue;
          try {
            const correction = await webflowUpdateImageAlt(webflowCreds, assetId, best.text);
            if (correction) {
              result.injected = true;
              injectedCount++;
            }
          } catch {
            // skip — non-blocking
          }
        }
      } catch {
        // Webflow unreachable
      }
    }
    // Skip for V1 — export CSV instead

    if (injectedCount > 0) {
      session.steps.push({
        id: 'inject',
        name: `${injectedCount} ALT texts injectés dans le CMS`,
        status: 'done',
      });
    }
  }

  const output: Alt12Output = {
    results: allResults,
    qualityReport,
    injected: injectedCount > 0,
  };

  session.output = output;
  return session;
}

export { ALT12_SYSTEM_PROMPT };
export * from './types';
