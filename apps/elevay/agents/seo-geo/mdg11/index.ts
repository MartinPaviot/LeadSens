import { mdg11InputSchema } from '../schemas';
import { AgentContext, AgentSession } from '../../../core/types';
import { Mdg11Inputs, Mdg11Output, PageMeta, MetaDescriptionResult, MDG11_BATCH_SIZE } from './types';
import {
  fetchPageKeyword,
  detectPageType,
  processPageBatch,
  buildQualityReport,
} from './workflow';
import { MDG11_SYSTEM_PROMPT } from './prompt';
import {
  wpGetPages,
  wpGetPosts,
  wpUpdateMeta,
  type WordPressCredentials,
} from '../../../core/tools/cms/wordpress';
import {
  hubGetPageMap,
  hubUpdateMeta,
  type HubSpotCredentials,
} from '../../../core/tools/cms/hubspot';
import type { ShopifyCredentials } from '../../../core/tools/cms/shopify';
import {
  webflowGetSiteMap,
  webflowUpdatePageMeta,
  webflowUpdateCollectionItemMeta,
  type WebflowCredentials,
} from '../../../core/tools/cms/webflow';

export async function activate(
  context: AgentContext,
  inputs: Mdg11Inputs,
  pages: { url: string; title: string; currentMeta: string }[],
  wpCredentials?: WordPressCredentials,
  hubCreds?: HubSpotCredentials,
  shopifyCreds?: ShopifyCredentials,
  webflowCreds?: WebflowCredentials,
): Promise<AgentSession> {
  mdg11InputSchema.parse(inputs);
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

  // Step 2 — Process in batches
  const BATCH_SIZE = MDG11_BATCH_SIZE;
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

  // Step 4 — CMS injection (if enabled and not audit mode)
  let injectedCount = 0;
  if (inputs.inject && context.clientProfile.automationLevel !== 'audit') {
    if (inputs.cmsType === 'wordpress' && wpCredentials) {
      try {
        const [wpPages, wpPosts] = await Promise.allSettled([
          wpGetPages(wpCredentials, 100),
          wpGetPosts(wpCredentials, 100),
        ]);
        const urlToWp = new Map<string, { id: number; postType: 'pages' | 'posts' }>();
        if (wpPages.status === 'fulfilled') {
          for (const p of wpPages.value) urlToWp.set(p.url.replace(/\/+$/, '').toLowerCase(), { id: p.id, postType: 'pages' });
        }
        if (wpPosts.status === 'fulfilled') {
          for (const p of wpPosts.value) urlToWp.set(p.url.replace(/\/+$/, '').toLowerCase(), { id: p.id, postType: 'posts' });
        }

        for (const result of allResults) {
          const best = result.variations.find((v) => v.valid);
          if (!best) continue;
          const entry = urlToWp.get(result.url.replace(/\/+$/, '').toLowerCase());
          if (!entry) continue;
          try {
            await wpUpdateMeta(wpCredentials, entry.id, '', best.text, entry.postType);
            result.injected = true;
            injectedCount++;
          } catch {
            // skip this page — non-blocking
          }
        }
      } catch {
        // WordPress unreachable — skip injection
      }
    } else if (inputs.cmsType === 'hubspot' && hubCreds) {
      try {
        const pageMap = await hubGetPageMap(hubCreds);
        for (const result of allResults) {
          const best = result.variations.find((v) => v.valid);
          if (!best) continue;
          const entry = pageMap.get(result.url.replace(/\/+$/, '').toLowerCase());
          if (!entry) continue;
          try {
            await hubUpdateMeta(hubCreds, entry.id, { metaDescription: best.text }, entry.type);
            result.injected = true;
            injectedCount++;
          } catch {
            // skip — non-blocking
          }
        }
      } catch {
        // HubSpot unreachable — skip injection
      }
    } else if (inputs.cmsType === 'webflow' && webflowCreds) {
      try {
        const siteMap = await webflowGetSiteMap(webflowCreds);
        for (const result of allResults) {
          const best = result.variations.find((v) => v.valid);
          if (!best) continue;
          // Try matching by URL path
          const urlPath = result.url.replace(/\/+$/, '').toLowerCase();
          // Try full URL and just the path portion
          const pathOnly = new URL(result.url, 'https://placeholder').pathname.replace(/\/+$/, '').toLowerCase();
          const entry = siteMap.get(urlPath) ?? siteMap.get(pathOnly);
          if (!entry) continue;
          try {
            if (entry.type === 'page' && entry.pageId) {
              await webflowUpdatePageMeta(webflowCreds, entry.pageId, { metaDescription: best.text });
            } else if (entry.type === 'blog' && entry.collectionId && entry.itemId) {
              await webflowUpdateCollectionItemMeta(webflowCreds, entry.collectionId, entry.itemId, { metaDescription: best.text });
            } else {
              continue;
            }
            result.injected = true;
            injectedCount++;
          } catch {
            // skip — non-blocking
          }
        }
      } catch {
        // Webflow unreachable
      }
    }
    // Shopify: meta description injection requires page IDs — not easily available from URLs
    // Skip for now, export CSV instead

    if (injectedCount > 0) {
      session.steps.push({
        id: 'inject',
        name: `${injectedCount} meta descriptions injectées dans le CMS`,
        status: 'done',
      });
    }
  }

  const output: Mdg11Output = {
    results: allResults,
    qualityReport,
    injected: injectedCount > 0,
  };

  session.output = output;
  return session;
}

export { MDG11_SYSTEM_PROMPT };
export * from './types';
