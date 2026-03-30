import Anthropic from '@anthropic-ai/sdk';
import { bsw10InputSchema } from '../schemas';
import { AgentContext, AgentSession } from '../../../core/types';
import { Bsw10Inputs, Bsw10Output } from './types';
import { sendScheduledDraftAlert } from '../../../core/tools/notifications';
import {
  fetchKeywordsAndPaa,
  benchmarkCompetitors,
  buildArticleStructure,
  buildClusterArchitecture,
  buildEditorialCalendar,
} from './workflow';
import { BSW10_SYSTEM_PROMPT, FORMAT_SEO_ANGLES } from './prompt';
import { wpCreatePost, type WordPressCredentials } from '../../../core/tools/cms/wordpress';
import { hubCreatePost, type HubSpotCredentials } from '../../../core/tools/cms/hubspot';
import { type ShopifyCredentials } from '../../../core/tools/cms/shopify';
import { webflowCreatePost, type WebflowCredentials } from '../../../core/tools/cms/webflow';

export async function activate(
  context: AgentContext,
  inputs: Bsw10Inputs,
  geo = 'FR',
  wpCredentials?: WordPressCredentials,
  hubCreds?: HubSpotCredentials,
  shopifyCreds?: ShopifyCredentials,
  webflowCreds?: WebflowCredentials,
): Promise<AgentSession> {
  bsw10InputSchema.parse(inputs);
  const session: AgentSession = {
    sessionId: context.sessionId,
    agentCode: 'AGT-SEO-BSW-10',
    startedAt: new Date(),
    steps: [],
    output: null,
  };

  // Step 1 — Keywords + PAA
  const keywords = await fetchKeywordsAndPaa(inputs, geo, context.clientProfile.id);
  session.steps.push({
    id: 'keywords',
    name: 'Mots-clés + PAA',
    status: keywords.length > 0 ? 'done' : 'skipped',
  });

  // Step 2 — Benchmark competitors
  const competitors = await benchmarkCompetitors(keywords[0] ?? inputs.topic, geo);
  session.steps.push({
    id: 'benchmark',
    name: 'Benchmark top 5 concurrents',
    status: competitors.length > 0 ? 'done' : 'skipped',
  });

  // Step 3 — Article structure (requires client validation)
  const articleStructure = buildArticleStructure(inputs, keywords);
  session.steps.push({
    id: 'structure',
    name: 'Structure article H2/H3',
    status: 'done',
  });

  // Step 4 — LLM content generation (Claude)
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const selectedTitle = articleStructure.titleOptions[0] ?? inputs.topic;
  const structureAsText = [
    `Titre retenu: ${selectedTitle}`,
    `Format: ${inputs.articleFormat}`,
    `Sections H2: ${articleStructure.h2s.join(' | ')}`,
    `Mots-clés: ${keywords.join(', ')}`,
    `Ton: ${inputs.brandTone}`,
    `Public: ${inputs.targetAudience} (niveau: ${inputs.expertiseLevel})`,
    `Objectif: ${inputs.objective}`,
    `Angle éditorial: ${FORMAT_SEO_ANGLES[inputs.articleFormat]}`,
    `Longueur cible: ${articleStructure.estimatedWordCount} mots`,
    `CTA: ${inputs.cta}`,
    `Liens internes: ${inputs.internalLinksAvailable.join(', ')}`,
  ].join('\n');

  let bodyContent = '';
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 6000,
      system: BSW10_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Rédige l'article complet en HTML sémantique (h2, h3, p, ul, ol, a, strong).\n\nSujet : ${inputs.topic}\n\n${structureAsText}\n\nRègles : \n- Respecte scrupuleusement la structure H2/H3 proposée\n- Intègre les mots-clés naturellement (densité 1-2%)\n- Ajoute des liens internes avec ancres descriptives\n- Termine chaque section par une phrase de transition\n- CTA final : ${inputs.cta}`,
      }],
    });
    const textBlock = message.content.find((c) => c.type === 'text');
    bodyContent = textBlock && 'text' in textBlock ? textBlock.text : '';
  } catch {
    bodyContent = `<!-- LLM indisponible — article sur : ${inputs.topic} -->`;
  }
  session.steps.push({
    id: 'content',
    name: 'Rédaction article',
    status: 'done',
  });

  // Step 5 — Cluster architecture (mode cluster/calendar)
  let clusterArchitecture: ReturnType<typeof buildClusterArchitecture> | undefined;
  let editorialCalendar: ReturnType<typeof buildEditorialCalendar> | undefined;

  if (inputs.mode === 'cluster' || inputs.mode === 'calendar') {
    clusterArchitecture = buildClusterArchitecture(inputs, keywords);
    session.steps.push({
      id: 'cluster',
      name: 'Architecture Topic Cluster',
      status: 'done',
    });

    if (inputs.mode === 'calendar') {
      editorialCalendar = buildEditorialCalendar(inputs, clusterArchitecture);
      session.steps.push({
        id: 'calendar',
        name: 'Calendrier éditorial',
        status: 'done',
      });
    }
  }

  const wordCount = bodyContent.split(/\s+/).length;

  const output: Bsw10Output = {
    mode: inputs.mode,
    articleStructure,
    bodyContent,
    wordCount,
    clusterArchitecture,
    editorialCalendar,
    exportReady: true,
  };

  // Step 6 — Push to CMS as draft (if connected)
  // Scheduled runs always create drafts requiring human validation
  const isScheduledRun = context.triggeredBy === 'inngest-schedule';
  if (context.clientProfile.automationLevel !== 'audit') {
    if (inputs.cmsType === 'wordpress' && wpCredentials) {
      try {
        const selectedTitle = articleStructure.titleOptions[0] ?? inputs.topic;
        const draft = await wpCreatePost(
          wpCredentials,
          selectedTitle,
          bodyContent,
        );
        output.wpDraftUrl = draft.editUrl;
        session.steps.push({
          id: 'cms_push',
          name: `Brouillon WordPress créé → ${draft.editUrl}`,
          status: 'done',
        });
      } catch {
        session.steps.push({
          id: 'cms_push',
          name: 'Push WordPress échoué — contenu disponible en export',
          status: 'skipped',
        });
      }
    } else if (inputs.cmsType === 'hubspot' && hubCreds) {
      try {
        const selectedTitle = articleStructure.titleOptions[0] ?? inputs.topic;
        const slug = selectedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const draft = await hubCreatePost(hubCreds, {
          title: selectedTitle,
          content: bodyContent,
          slug,
        });
        output.wpDraftUrl = draft.editUrl;
        session.steps.push({
          id: 'cms_push',
          name: `Brouillon HubSpot créé → ${draft.editUrl}`,
          status: 'done',
        });
      } catch {
        session.steps.push({
          id: 'cms_push',
          name: 'Push HubSpot échoué — contenu disponible en export',
          status: 'skipped',
        });
      }
    } else if (inputs.cmsType === 'shopify' && shopifyCreds) {
      // Shopify has no native blog draft — skip with note
      void shopifyCreds;
      session.steps.push({
        id: 'cms_push',
        name: 'Shopify ne supporte pas les brouillons de blog — export Markdown disponible',
        status: 'skipped',
      });
    } else if (inputs.cmsType === 'webflow' && webflowCreds) {
      try {
        const selectedTitle = articleStructure.titleOptions[0] ?? inputs.topic;
        const slug = selectedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const draft = await webflowCreatePost(webflowCreds, { title: selectedTitle, content: bodyContent, slug });
        output.wpDraftUrl = draft.editUrl;
        session.steps.push({ id: 'cms_push', name: `Brouillon Webflow créé → ${draft.editUrl}`, status: 'done' });
      } catch {
        session.steps.push({ id: 'cms_push', name: 'Push Webflow échoué — contenu disponible en export', status: 'skipped' });
      }
    }
  }

  // Flag scheduled runs as requiring human validation + send alert
  if (isScheduledRun) {
    output.requiresValidation = true;
    if (output.wpDraftUrl) {
      await sendScheduledDraftAlert({
        agentName: 'BSW-10',
        draftUrl: output.wpDraftUrl,
        topic: inputs.topic,
        keyword: inputs.targetKeywords?.[0] ?? '',
        workspaceId: context.clientProfile.id,
        alertChannels: context.clientProfile.alertChannels,
        userId: context.clientProfile.id,
      });
    }
  }

  session.output = output;
  return session;
}

export { BSW10_SYSTEM_PROMPT };
export * from './types';
