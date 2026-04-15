import { auth } from '@/lib/auth';
import { SSEEncoder, SSE_HEADERS, generateStreamId } from '@/lib/sse';
import { wpw09RouteSchema } from '@/lib/schemas/seo-routes';
import { checkRateLimit } from '@/lib/rate-limit';
import type { AgentContext } from '../../../../../../core/types';
import { activate } from '../../../../../../agents/seo-geo/wpw09';
import type { Wpw09Inputs, Wpw09PageOutput } from '../../../../../../agents/seo-geo/wpw09/types';

export const dynamic = 'force-dynamic'

export const maxDuration = 120;

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  // Rate limit
  const rl = await checkRateLimit(session.user.id, 'wpw09');
  if (!rl.allowed) {
    return Response.json(
      { error: 'Rate limit exceeded', retryAfter: rl.retryAfter },
      { status: 429 },
    );
  }

  const parsed = wpw09RouteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request body', details: parsed.error.format() }, { status: 400 });
  }
  const {
    conversationId,
    profile,
    pageType,
    brief,
    targetKeywords,
    brandTone,
    targetAudience,
    internalLinksAvailable,
    exportFormat,
  } = parsed.data;

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
        // activate() runs all steps sequentially: fetchKeywords → benchmarkSerp → buildStructure → LLM → buildPageOutput
        controller.enqueue(encoder.encode('status', { step: 2, total: 5, label: '[2/5] SERP competitor benchmark…' }));
        controller.enqueue(encoder.encode('status', { step: 3, total: 5, label: '[3/5] H1/H2/H3 structure…' }));
        controller.enqueue(encoder.encode('status', { step: 4, total: 5, label: '[4/5] Writing content (Claude)…' }));
        const agentSession = await activate(context, inputs, profile.targetGeos[0] ?? 'FR', profile.wordpressCredentials ?? undefined, profile.hubspotCredentials ?? undefined, profile.shopifyCredentials ?? undefined, profile.webflowCredentials ?? undefined);
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
          tokensIn: 0,
          tokensOut: 0,
          totalSteps: 5,
          finishReason: 'stop',
        }));
        controller.enqueue(encoder.encode('stream-end', {}));
      } catch (err) {
        void err;
        controller.enqueue(encoder.encode('error', { message: 'Une erreur est survenue.' }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

// ─── Output formatter ─────────────────────────────────────

function formatWpw09Output(output: Wpw09PageOutput | null): string {
  if (!output) {
    return '## WPW-09 — Error\n\nPage generation failed.';
  }

  const lines: string[] = [
    `## Page générée : ${output.h1}`,
    '',
    `**Meta title** : ${output.metaTitle}`,
    `**Meta description** : ${output.metaDescription}`,
    `**Longueur** : ${output.wordCount} mots · ${output.internalLinks.length} lien(s) interne(s)`,
    '',
    '---',
    '',
    output.bodyContent,
  ];

  if (output.cta.length > 0) {
    lines.push('', `**CTAs** : ${output.cta.join(' · ')}`);
  }

  if (output.imageRecommendations.length > 0) {
    lines.push('', '### Recommandations images');
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
