import { auth } from '@/lib/auth';
import { SSEEncoder, SSE_HEADERS, generateStreamId } from '@/lib/sse';
import { agentRouteSchema } from '@/lib/schemas/seo-routes';
import { checkRateLimit } from '@/lib/rate-limit';
import type { AgentContext } from '../../../../../../core/types';
import { activate } from '../../../../../../agents/seo-geo/mdg11';
import type { Mdg11Inputs, Mdg11Output } from '../../../../../../agents/seo-geo/mdg11/types';
import { crawlSite } from '../../../../../../core/tools/dataForSeo';
import type { CrawlResult } from '../../../../../../core/tools/dataForSeo';

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  // Rate limit
  const rl = await checkRateLimit(session.user.id, 'mdg-11');
  if (!rl.allowed) {
    return Response.json(
      { error: 'Rate limit exceeded', retryAfter: rl.retryAfter },
      { status: 429 },
    );
  }

  const parsed = agentRouteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request body', details: parsed.error.format() }, { status: 400 });
  }
  const { conversationId, siteUrl, profile } = parsed.data;

  const encoder = new SSEEncoder();
  const streamId = generateStreamId();

  const context: AgentContext = {
    clientProfile: {
      id: session.user.id,
      siteUrl: profile.siteUrl,
      cmsType: profile.cmsType,
      automationLevel: profile.automationLevel,
      geoLevel: profile.geoLevel,
      targetGeos: profile.targetGeos,
      priorityPages: profile.priorityPages,
      alertChannels: profile.alertChannels,
      connectedTools: profile.connectedTools,
    },
    sessionId: streamId,
    triggeredBy: 'user',
  };

  const inputs: Mdg11Inputs = {
    siteUrl,
    scope: 'all',
    cmsType: profile.cmsType,
    brandTone: 'informative',
    variationsCount: 3,
    language: 'fr',
    inject: false,
  };

  const wpCreds = profile.wordpressCredentials;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.retryDirective(3000));
        controller.enqueue(encoder.encode('stream-start', { streamId, conversationId, ts: Date.now() }));

        // Step 1 — Build page list (WP API or DataForSEO crawl)
        let pageList: { url: string; title: string; currentMeta: string }[] = [];

        if (wpCreds && profile.cmsType === 'wordpress') {
          controller.enqueue(encoder.encode('status', { step: 1, total: 4, label: '[1/4] Récupération pages WordPress…' }));
          const { wpGetPages, wpGetPosts } = await import('../../../../../../core/tools/cms/wordpress');
          const [pages, posts] = await Promise.allSettled([
            wpGetPages(wpCreds),
            wpGetPosts(wpCreds),
          ]);
          pageList = [
            ...(pages.status === 'fulfilled' ? pages.value : []),
            ...(posts.status === 'fulfilled' ? posts.value : []),
          ].map((p) => ({
            url: p.url,
            title: p.title,
            currentMeta: p.metaDescription,
          }));
        } else {
          controller.enqueue(encoder.encode('status', { step: 1, total: 4, label: '[1/4] Crawl du site…' }));
          const crawlResults = await crawlSite(siteUrl).catch(() => [] as CrawlResult[]);
          pageList = crawlResults.map((p) => ({
            url: p.url,
            title: p.title ?? '',
            currentMeta: p.metaDescription ?? '',
          }));
        }

        // Step 2 — Generate meta descriptions
        controller.enqueue(encoder.encode('status', { step: 2, total: 4, label: `[2/4] Génération des meta descriptions (${pageList.length} pages)…` }));
        const agentSession = await activate(context, inputs, pageList, wpCreds ?? undefined, profile.hubspotCredentials ?? undefined, profile.shopifyCredentials ?? undefined, profile.webflowCredentials ?? undefined);

        // Step 3+4 — Quality report
        controller.enqueue(encoder.encode('status', { step: 3, total: 4, label: '[3/4] Contrôle qualité 155-160 caractères…' }));
        controller.enqueue(encoder.encode('status', { step: 4, total: 4, label: '[4/4] Rapport final…' }));

        controller.enqueue(encoder.encode('result', {
          bpiOutput: { agent: 'MDG-11', siteUrl },
          brandName: siteUrl,
        }));

        const output = agentSession.output as Mdg11Output | { error: string } | null;
        const text = formatMdg11Report(siteUrl, output, pageList.length);
        for (const char of text) {
          controller.enqueue(encoder.encode('text-delta', { delta: char }));
        }

        controller.enqueue(encoder.encode('finish', {
          tokensIn: 0,
          tokensOut: 0,
          totalSteps: 4,
          finishReason: 'stop',
        }));
        controller.enqueue(encoder.encode('stream-end', {}));
      } catch (err) {
        console.error('[mdg-11]', err);
        controller.enqueue(encoder.encode('error', { message: 'Une erreur est survenue.' }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

// ─── Output formatter ─────────────────────────────────────

function formatMdg11Report(
  siteUrl: string,
  output: Mdg11Output | { error: string } | null,
  totalPages: number,
): string {
  if (!output || 'error' in output) {
    const reason = output && 'error' in output ? output.error : 'Aucune donnée disponible';
    return [
      `## Générateur Meta Descriptions MDG-11 — ${siteUrl}`,
      '',
      reason,
    ].join('\n');
  }

  const { results, qualityReport } = output;

  const lines: string[] = [
    `## Meta Descriptions — ${siteUrl}`,
    '',
    `**${totalPages} pages analysées** · ${results.length} metas générées · ${qualityReport.valid} valides · ${qualityReport.invalid} à corriger`,
    '',
  ];

  if (results.length > 0) {
    lines.push('### Exemples générés');
    for (const result of results.slice(0, 5)) {
      const best = result.variations.find((v) => v.valid) ?? result.variations[0];
      if (best) {
        lines.push(`**${result.url}**`);
        lines.push(`> ${best.text} _(${best.charCount} car.)_`);
        lines.push('');
      }
    }
  }

  if (qualityReport.invalid > 0) {
    lines.push('### Problèmes détectés');
    for (const [issue, count] of Object.entries(qualityReport.issues) as [string, number][]) {
      if (count > 0) lines.push(`- **${issue}** : ${count} pages`);
    }
    lines.push('');
  }

  lines.push('Pour injecter ces metas directement dans votre CMS, configurez WordPress / HubSpot / Shopify / Webflow dans les paramètres.');

  return lines.join('\n');
}
