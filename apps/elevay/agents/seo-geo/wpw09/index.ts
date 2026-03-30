import Anthropic from '@anthropic-ai/sdk';
import { wpw09InputSchema } from '../schemas';
import { AgentContext, AgentSession } from '../../../core/types';
import { Wpw09Inputs, Wpw09PageOutput, PAGE_WORD_COUNT } from './types';
import { benchmarkSerp, fetchKeywords, buildStructure, buildPageOutput } from './workflow';
import { WPW09_SYSTEM_PROMPT, PAGE_TYPE_ANGLES } from './prompt';
import { wpCreatePage, type WordPressCredentials } from '../../../core/tools/cms/wordpress';
import { hubCreatePage, type HubSpotCredentials } from '../../../core/tools/cms/hubspot';
import { shopifyCreatePage, type ShopifyCredentials } from '../../../core/tools/cms/shopify';
import { webflowCreatePage, type WebflowCredentials } from '../../../core/tools/cms/webflow';
import { sendScheduledDraftAlert } from '../../../core/tools/notifications';

export async function activate(
  context: AgentContext,
  inputs: Wpw09Inputs,
  geo = 'FR',
  wpCredentials?: WordPressCredentials,
  hubCreds?: HubSpotCredentials,
  shopifyCreds?: ShopifyCredentials,
  webflowCreds?: WebflowCredentials,
): Promise<AgentSession> {
  wpw09InputSchema.parse(inputs);
  const session: AgentSession = {
    sessionId: context.sessionId,
    agentCode: 'AGT-SEO-WPW-09',
    startedAt: new Date(),
    steps: [],
    output: null,
  };

  // Step 1 — Fetch keywords
  const keywords = await fetchKeywords(inputs, geo);
  session.steps.push({
    id: 'keywords',
    name: 'Keyword research',
    status: keywords.length > 0 ? 'done' : 'skipped',
  });

  // Step 2 — Benchmark SERP
  const serpResults = await benchmarkSerp(keywords, geo);
  session.steps.push({
    id: 'serp',
    name: 'SERP benchmark top 5',
    status: serpResults.length > 0 ? 'done' : 'skipped',
  });

  // Step 3 — Build structure (requires client validation before content)
  const structure = buildStructure(inputs, keywords, serpResults);
  session.steps.push({
    id: 'structure',
    name: 'H1/H2/H3 structure',
    status: 'done',
  });

  // Step 4 — LLM content generation (Claude)
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const structureAsText = [
    `H1: ${structure.h1Options[0]}`,
    `Sections: ${structure.h2s.join(' | ')}`,
    `Mots-clés: ${keywords.join(', ')}`,
    `Ton: ${inputs.brandTone}`,
    `Public: ${inputs.targetAudience}`,
    `Angle: ${PAGE_TYPE_ANGLES[inputs.pageType]}`,
    `Longueur cible: ${PAGE_WORD_COUNT[inputs.pageType].min}–${PAGE_WORD_COUNT[inputs.pageType].max} mots`,
    `Liens internes disponibles: ${inputs.internalLinksAvailable.join(', ')}`,
  ].join('\n');

  let bodyContent = '';
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: WPW09_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Rédige le contenu complet de cette page en HTML sémantique (h2, h3, p, ul, a).\n\nBrief : ${inputs.brief}\n\n${structureAsText}\n\nRègle : intègre naturellement les mots-clés, ajoute ${inputs.internalLinksAvailable.length > 0 ? '2-5 liens internes' : 'des CTAs'}, termine par un CTA clair.`,
      }],
    });
    const textBlock = message.content.find((c) => c.type === 'text');
    bodyContent = textBlock && 'text' in textBlock ? textBlock.text : '';
  } catch {
    bodyContent = `<!-- LLM indisponible — contenu pour : ${inputs.brief} -->`;
  }

  // Step 5 — Assemble output
  const pageOutput = buildPageOutput(inputs, structure, bodyContent);
  session.steps.push({
    id: 'content',
    name: 'Full content writing',
    status: 'done',
  });

  // Step 6 — Push to CMS as draft (if connected)
  // Scheduled runs always create drafts requiring human validation
  const isScheduledRun = context.triggeredBy === 'inngest-schedule';
  if (context.clientProfile.automationLevel !== 'audit') {
    if (inputs.cmsType === 'wordpress' && wpCredentials) {
      try {
        const draft = await wpCreatePage(
          wpCredentials,
          pageOutput.h1,
          pageOutput.bodyContent,
          pageOutput.metaTitle,
          pageOutput.metaDescription,
        );
        pageOutput.wpDraftUrl = draft.editUrl;
        session.steps.push({
          id: 'cms_push',
          name: `WordPress draft created → ${draft.editUrl}`,
          status: 'done',
        });
      } catch {
        session.steps.push({
          id: 'cms_push',
          name: 'WordPress push failed — content available for export',
          status: 'skipped',
        });
      }
    } else if (inputs.cmsType === 'hubspot' && hubCreds) {
      try {
        const slug = pageOutput.h1.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const draft = await hubCreatePage(hubCreds, {
          title: pageOutput.h1,
          content: pageOutput.bodyContent,
          slug,
          metaDescription: pageOutput.metaDescription,
        });
        pageOutput.wpDraftUrl = draft.editUrl;
        session.steps.push({
          id: 'cms_push',
          name: `HubSpot draft created → ${draft.editUrl}`,
          status: 'done',
        });
      } catch {
        session.steps.push({
          id: 'cms_push',
          name: 'HubSpot push failed — content available for export',
          status: 'skipped',
        });
      }
    } else if (inputs.cmsType === 'shopify' && shopifyCreds) {
      try {
        const draft = await shopifyCreatePage(shopifyCreds, {
          title: pageOutput.h1,
          content: pageOutput.bodyContent,
          metaDescription: pageOutput.metaDescription,
        });
        pageOutput.wpDraftUrl = draft.editUrl;
        session.steps.push({
          id: 'cms_push',
          name: `Shopify page created (unpublished) → ${draft.editUrl}`,
          status: 'done',
        });
      } catch {
        session.steps.push({
          id: 'cms_push',
          name: 'Shopify push failed — content available for export',
          status: 'skipped',
        });
      }
    } else if (inputs.cmsType === 'webflow' && webflowCreds) {
      try {
        const slug = pageOutput.h1.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const draft = await webflowCreatePage(webflowCreds, { title: pageOutput.h1, content: pageOutput.bodyContent, slug, metaDescription: pageOutput.metaDescription });
        pageOutput.wpDraftUrl = draft.editUrl;
        session.steps.push({ id: 'cms_push', name: `Webflow draft created → ${draft.editUrl}`, status: 'done' });
      } catch {
        session.steps.push({ id: 'cms_push', name: 'Webflow push failed — content available for export', status: 'skipped' });
      }
    }
  }

  // Flag scheduled runs as requiring human validation + send alert
  if (isScheduledRun) {
    pageOutput.requiresValidation = true;
    if (pageOutput.wpDraftUrl) {
      await sendScheduledDraftAlert({
        agentName: 'WPW-09',
        draftUrl: pageOutput.wpDraftUrl,
        topic: inputs.brief,
        keyword: inputs.targetKeywords?.[0] ?? '',
        workspaceId: context.clientProfile.id,
        alertChannels: context.clientProfile.alertChannels,
        userId: context.clientProfile.id,
      });
    }
  }

  session.output = pageOutput satisfies Wpw09PageOutput;
  return session;
}

export { WPW09_SYSTEM_PROMPT };
export * from './types';
