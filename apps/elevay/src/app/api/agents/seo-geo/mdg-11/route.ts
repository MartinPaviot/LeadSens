import { SSEEncoder, SSE_HEADERS, generateStreamId } from '@/lib/sse';
import { agentRouteSchema } from '@/lib/schemas/seo-routes';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveSeoContext } from '@/lib/seo-route-helpers';
import type { AgentContext } from '@core/types';
import { activate } from '@agents/seo-geo/mdg11';
import type { Mdg11Inputs, Mdg11Output } from '@agents/seo-geo/mdg11/types';
import { crawlSite } from '@core/tools/dataForSeo';
import type { CrawlResult } from '@core/tools/dataForSeo';

export const dynamic = 'force-dynamic'

export const maxDuration = 60;

export async function POST(req: Request) {
  const parsed = agentRouteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request body', details: parsed.error.format() }, { status: 400 });
  }
  const { conversationId, siteUrl: siteUrlOverride, profile: profileOverride } = parsed.data;

  const resolved = await resolveSeoContext(profileOverride, siteUrlOverride);
  if (resolved instanceof Response) return resolved;

  const rl = await checkRateLimit(resolved.session.user.id, 'mdg-11');
  if (!rl.allowed) {
    return Response.json(
      { error: 'Rate limit exceeded', retryAfter: rl.retryAfter },
      { status: 429 },
    );
  }

  const { profile, siteUrl, ctx } = resolved;
  const encoder = new SSEEncoder();
  const streamId = generateStreamId();

  const context: AgentContext = {
    clientProfile: profile,
    sessionId: streamId,
    triggeredBy: 'user',
  };

  const inputs: Mdg11Inputs = {
    siteUrl,
    scope: 'all',
    cmsType: profile.cmsType,
    brandTone: 'informative',
    variationsCount: 3,
    language: ctx.settings.language ?? 'fr',
    inject: false,
  };

  const wpCreds = profileOverride?.wordpressCredentials;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.retryDirective(3000));
        controller.enqueue(encoder.encode('stream-start', { streamId, conversationId, ts: Date.now() }));

        // Step 1 — Build page list (WP API or DataForSEO crawl)
        let pageList: { url: string; title: string; currentMeta: string }[] = [];

        if (wpCreds && profile.cmsType === 'wordpress') {
          controller.enqueue(encoder.encode('status', { step: 1, total: 4, label: '[1/4] Fetching WordPress pages…' }));
          const { wpGetPages, wpGetPosts } = await import('@core/tools/cms/wordpress');
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
          controller.enqueue(encoder.encode('status', { step: 1, total: 4, label: '[1/4] Crawling site…' }));
          const crawlResults = await crawlSite(siteUrl).catch(() => [] as CrawlResult[]);
          pageList = crawlResults.map((p) => ({
            url: p.url,
            title: p.title ?? '',
            currentMeta: p.metaDescription ?? '',
          }));
        }

        // Step 2 — Generate meta descriptions
        controller.enqueue(encoder.encode('status', { step: 2, total: 4, label: `[2/4] Generating meta descriptions (${pageList.length} pages)…` }));
        const agentSession = await activate(
          context,
          inputs,
          pageList,
          wpCreds ?? undefined,
          profileOverride?.hubspotCredentials ?? undefined,
          profileOverride?.shopifyCredentials ?? undefined,
          profileOverride?.webflowCredentials ?? undefined,
        );

        // Step 3+4 — Quality report
        controller.enqueue(encoder.encode('status', { step: 3, total: 4, label: '[3/4] Quality check 155-160 characters…' }));
        controller.enqueue(encoder.encode('status', { step: 4, total: 4, label: '[4/4] Final report…' }));

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
        void err;
        controller.enqueue(encoder.encode('error', { message: 'An error occurred.' }));
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
    const reason = output && 'error' in output ? output.error : 'No data available';
    return [
      `## Meta Description Generator MDG-11 — ${siteUrl}`,
      '',
      reason,
    ].join('\n');
  }

  const { results, qualityReport } = output;

  const lines: string[] = [
    `## Meta Descriptions — ${siteUrl}`,
    '',
    `**${totalPages} pages analyzed** · ${results.length} metas generated · ${qualityReport.valid} valid · ${qualityReport.invalid} to fix`,
    '',
  ];

  if (results.length > 0) {
    lines.push('### Generated examples');
    for (const result of results.slice(0, 5)) {
      const best = result.variations.find((v) => v.valid) ?? result.variations[0];
      if (best) {
        lines.push(`**${result.url}**`);
        lines.push(`> ${best.text} _(${best.charCount} chars)_`);
        lines.push('');
      }
    }
  }

  if (qualityReport.invalid > 0) {
    lines.push('### Issues detected');
    for (const [issue, count] of Object.entries(qualityReport.issues) as [string, number][]) {
      if (count > 0) lines.push(`- **${issue}**: ${count} pages`);
    }
    lines.push('');
  }

  lines.push('To inject these metas directly into your CMS, configure WordPress / HubSpot / Shopify / Webflow in settings.');

  return lines.join('\n');
}
