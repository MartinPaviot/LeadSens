import { SSEEncoder, SSE_HEADERS, generateStreamId } from '@/lib/sse';
import { wpw09RouteSchema } from '@/lib/schemas/seo-routes';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveSeoContext } from '@/lib/seo-route-helpers';
import type { AgentContext } from '@core/types';
import { activate } from '@agents/seo-geo/wpw09';
import type { Wpw09Inputs, Wpw09PageOutput } from '@agents/seo-geo/wpw09/types';

export const dynamic = 'force-dynamic'

export const maxDuration = 120;

export async function POST(req: Request) {
  const parsed = wpw09RouteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request body', details: parsed.error.format() }, { status: 400 });
  }
  const {
    conversationId,
    profile: profileOverride,
    pageType,
    brief,
    targetKeywords,
    brandTone,
    targetAudience,
    internalLinksAvailable,
    exportFormat,
  } = parsed.data;

  const resolved = await resolveSeoContext(profileOverride);
  if (resolved instanceof Response) return resolved;

  const rl = await checkRateLimit(resolved.session.user.id, 'wpw09');
  if (!rl.allowed) {
    return Response.json(
      { error: 'Rate limit exceeded', retryAfter: rl.retryAfter },
      { status: 429 },
    );
  }

  const { profile } = resolved;
  const encoder = new SSEEncoder();
  const streamId = generateStreamId();

  const context: AgentContext = {
    clientProfile: profile,
    sessionId: streamId,
    triggeredBy: 'user',
  };

  const inputs: Wpw09Inputs = {
    pageType,
    brief,
    targetKeywords,
    brandTone,
    targetAudience,
    internalLinksAvailable: internalLinksAvailable ?? [],
    cmsType: profile.cmsType,
    exportFormat: exportFormat ?? 'html',
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.retryDirective(3000));
        controller.enqueue(encoder.encode('stream-start', { streamId, conversationId, ts: Date.now() }));

        controller.enqueue(encoder.encode('status', { step: 1, total: 5, label: '[1/5] Keyword research…' }));
        controller.enqueue(encoder.encode('status', { step: 2, total: 5, label: '[2/5] SERP competitor benchmark…' }));
        controller.enqueue(encoder.encode('status', { step: 3, total: 5, label: '[3/5] H1/H2/H3 structure…' }));
        controller.enqueue(encoder.encode('status', { step: 4, total: 5, label: '[4/5] Writing content (Claude)…' }));
        const agentSession = await activate(
          context,
          inputs,
          profile.targetGeos[0] ?? 'FR',
          profileOverride?.wordpressCredentials ?? undefined,
          profileOverride?.hubspotCredentials ?? undefined,
          profileOverride?.shopifyCredentials ?? undefined,
          profileOverride?.webflowCredentials ?? undefined,
        );
        controller.enqueue(encoder.encode('status', { step: 5, total: 5, label: '[5/5] Finalizing and export…' }));

        controller.enqueue(encoder.encode('result', {
          bpiOutput: { agent: 'WPW-09', siteUrl: profile.siteUrl },
          brandName: profile.siteUrl,
        }));

        const output = agentSession.output as Wpw09PageOutput | null;
        const text = formatWpw09Output(output);
        for (const char of text) {
          controller.enqueue(encoder.encode('text-delta', { delta: char }));
        }

        controller.enqueue(encoder.encode('finish', {
          tokensIn: 0, tokensOut: 0, totalSteps: 5, finishReason: 'stop',
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

function formatWpw09Output(output: Wpw09PageOutput | null): string {
  if (!output) {
    return '## WPW-09 — Error\n\nPage generation failed.';
  }

  const lines: string[] = [
    `## Generated Page: ${output.h1}`,
    '',
    `**Meta title**: ${output.metaTitle}`,
    `**Meta description**: ${output.metaDescription}`,
    `**Length**: ${output.wordCount} words · ${output.internalLinks.length} internal link(s)`,
    '',
    '---',
    '',
    output.bodyContent,
  ];

  if (output.cta.length > 0) {
    lines.push('', `**CTAs** : ${output.cta.join(' · ')}`);
  }

  if (output.imageRecommendations.length > 0) {
    lines.push('', '### Image recommendations');
    for (const img of output.imageRecommendations) {
      lines.push(`- ${img.description} — \`alt="${img.altText}"\``);
    }
  }

  if (output.wpDraftUrl) {
    lines.push('');
    lines.push(`> CMS draft created: [Edit draft](${output.wpDraftUrl})`);
  }

  return lines.join('\n');
}
