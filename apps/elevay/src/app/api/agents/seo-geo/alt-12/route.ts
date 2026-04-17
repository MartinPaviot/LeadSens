import { SSEEncoder, SSE_HEADERS, generateStreamId } from '@/lib/sse';
import { agentRouteSchema } from '@/lib/schemas/seo-routes';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveSeoContext } from '@/lib/seo-route-helpers';
import type { AgentContext } from '@core/types';
import { activate } from '@agents/seo-geo/alt12';
import type { Alt12Inputs, Alt12Output } from '@agents/seo-geo/alt12/types';

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

  const rl = await checkRateLimit(resolved.session.user.id, 'alt-12');
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

  const inputs: Alt12Inputs = {
    siteUrl,
    scope: 'all',
    cmsType: profile.cmsType,
    brandTone: 'descriptive',
    language: ctx.settings.language ?? 'fr',
    variationsCount: 2,
    inject: false,
  };

  const wpCreds = profileOverride?.wordpressCredentials;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.retryDirective(3000));
        controller.enqueue(encoder.encode('stream-start', { streamId, conversationId, ts: Date.now() }));

        let text: string;

        if (wpCreds && profile.cmsType === 'wordpress') {
          controller.enqueue(encoder.encode('status', { step: 1, total: 4, label: '[1/4] Crawling WordPress images…' }));
          const { wpGetImages } = await import('@core/tools/cms/wordpress');
          const images = await wpGetImages(wpCreds).catch(() => []);

          controller.enqueue(encoder.encode('status', { step: 2, total: 4, label: `[2/4] ${images.length} images found…` }));
          const imageList = images.map((img) => ({
            url: img.url,
            pageUrl: profile.siteUrl,
            pageTitle: '',
            currentAlt: img.altText,
            filename: img.filename,
          }));

          controller.enqueue(encoder.encode('status', { step: 3, total: 4, label: '[3/4] Classifying product / hero / decorative…' }));
          controller.enqueue(encoder.encode('status', { step: 4, total: 4, label: '[4/4] Generating WCAG 2.1 ALT texts…' }));
          const agentSession = await activate(
            context,
            inputs,
            imageList,
            wpCreds ?? undefined,
            profileOverride?.hubspotCredentials ?? undefined,
            profileOverride?.shopifyCredentials ?? undefined,
            profileOverride?.webflowCredentials ?? undefined,
          );

          controller.enqueue(encoder.encode('result', {
            bpiOutput: { agent: 'ALT-12', siteUrl },
            brandName: siteUrl,
          }));

          const output = agentSession.output as Alt12Output | { error: string } | null;
          text = formatAlt12Report(siteUrl, output, profile.cmsType);
        } else {
          controller.enqueue(encoder.encode('result', {
            bpiOutput: { agent: 'ALT-12', siteUrl },
            brandName: siteUrl,
          }));

          text = [
            `**ALT-12 — Export mode**`,
            ``,
            profile.cmsType === 'wordpress'
              ? `WordPress credentials not provided. Add them in onboarding for direct injection.`
              : profile.cmsType === 'hubspot'
                ? `HubSpot credentials not provided. Add them in onboarding for direct injection.`
                : profile.cmsType === 'shopify'
                  ? `Shopify credentials not provided. Add them in onboarding for direct injection.`
                  : profile.cmsType === 'webflow'
                    ? `Webflow credentials not provided. Add them in onboarding for direct injection.`
                    : `${profile.cmsType} connection required in settings for direct injection.`,
            ``,
            `CSV export is available after analysis.`,
          ].join('\n');
        }

        for (const char of text) {
          controller.enqueue(encoder.encode('text-delta', { delta: char }));
        }

        controller.enqueue(encoder.encode('finish', {
          tokensIn: 0,
          tokensOut: 0,
          totalSteps: wpCreds && profile.cmsType === 'wordpress' ? 4 : 1,
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

function formatAlt12Report(
  siteUrl: string,
  output: Alt12Output | { error: string } | null,
  cmsType: string,
): string {
  // Graceful degradation: WordPress credentials not yet configured
  if (!output || 'error' in output) {
    return [
      `## ALT Text Generator ALT-12 — ${siteUrl}`,
      '',
      'To generate ALT texts for your images, connect your CMS in settings.',
      '',
      '**What this agent generates:**',
      '- SEO + accessibility ALT texts (WCAG 2.1 AA)',
      '- Auto-classification: product · hero · infographic · decorative',
      '- Batch of 30 images in parallel',
      '- 80-120 characters, contextual keyword included',
      '',
      `**Detected CMS: ${cmsType}**`,
      cmsType === 'wordpress'
        ? 'Configure your WordPress credentials (Application Password) in settings to enable direct injection.'
        : `Configure your ${cmsType} connection via OAuth settings to enable direct injection.`,
    ].join('\n');
  }

  const { results, qualityReport } = output;

  const lines: string[] = [
    `## ALT Texts — ${siteUrl}`,
    '',
    `**${results.length} images processed** · ${qualityReport.valid} valid · ${qualityReport.invalid} to review`,
    '',
  ];

  if (results.length > 0) {
    lines.push('### Generated examples');
    for (const result of results.slice(0, 5)) {
      const best = result.variations[0];
      if (best) {
        lines.push(`**${result.imageUrl}**`);
        lines.push(`> ${best.text} _(${result.imageType})_`);
        lines.push('');
      }
    }
  }

  lines.push('To inject these ALT texts directly into your CMS, configure the connection in settings.');

  return lines.join('\n');
}
