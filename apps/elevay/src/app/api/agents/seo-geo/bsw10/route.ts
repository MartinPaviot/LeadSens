import { SSEEncoder, SSE_HEADERS, generateStreamId } from '@/lib/sse';
import { bsw10RouteSchema } from '@/lib/schemas/seo-routes';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveSeoContext } from '@/lib/seo-route-helpers';
import type { AgentContext } from '../../../../../../core/types';
import { activate } from '../../../../../../agents/seo-geo/bsw10';
import type { Bsw10Inputs, Bsw10Output } from '../../../../../../agents/seo-geo/bsw10/types';

export const dynamic = 'force-dynamic'

export const maxDuration = 120;

export async function POST(req: Request) {
  const parsed = bsw10RouteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request body', details: parsed.error.format() }, { status: 400 });
  }
  const {
    conversationId,
    profile: profileOverride,
    topic,
    mode,
    articleFormat,
    targetAudience,
    expertiseLevel,
    objective,
    brandTone,
    targetKeywords,
    internalLinksAvailable,
    cta,
    calendarDuration,
  } = parsed.data;

  const resolved = await resolveSeoContext(profileOverride);
  if (resolved instanceof Response) return resolved;

  const rl = await checkRateLimit(resolved.session.user.id, 'bsw10');
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

  const inputs: Bsw10Inputs = {
    topic,
    mode: mode ?? 'single',
    articleFormat,
    targetAudience,
    expertiseLevel: expertiseLevel ?? 'intermediate',
    objective: objective ?? 'traffic',
    brandTone,
    targetKeywords,
    internalLinksAvailable: internalLinksAvailable ?? [],
    cta,
    cmsType: profile.cmsType,
    calendarDuration,
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.retryDirective(3000));
        controller.enqueue(encoder.encode('stream-start', { streamId, conversationId, ts: Date.now() }));

        controller.enqueue(encoder.encode('status', { step: 1, total: 5, label: '[1/5] Keyword research + PAA…' }));
        controller.enqueue(encoder.encode('status', { step: 2, total: 5, label: '[2/5] Top 5 competitor benchmark…' }));
        controller.enqueue(encoder.encode('status', { step: 3, total: 5, label: '[3/5] Article H2/H3 structure…' }));
        controller.enqueue(encoder.encode('status', { step: 4, total: 5, label: '[4/5] Writing article (Claude)…' }));
        const agentSession = await activate(
          context,
          inputs,
          profile.targetGeos[0] ?? 'FR',
          profileOverride?.wordpressCredentials ?? undefined,
          profileOverride?.hubspotCredentials ?? undefined,
          profileOverride?.shopifyCredentials ?? undefined,
          profileOverride?.webflowCredentials ?? undefined,
        );
        controller.enqueue(encoder.encode('status', { step: 5, total: 5, label: '[5/5] Cluster and editorial calendar…' }));

        controller.enqueue(encoder.encode('result', {
          bpiOutput: { agent: 'BSW-10', siteUrl: profile.siteUrl },
          brandName: profile.siteUrl,
        }));

        const output = agentSession.output as Bsw10Output | null;
        const text = formatBsw10Output(output, inputs.articleFormat);
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

function formatBsw10Output(
  output: Bsw10Output | null,
  articleFormat: Bsw10Inputs['articleFormat'],
): string {
  if (!output) {
    return '## BSW-10 — Error\n\nArticle generation failed.';
  }

  const title = output.articleStructure.titleOptions[0] ?? 'Article';

  const lines: string[] = [
    `## ${title}`,
    '',
    `**Format** : ${articleFormat} · **${output.wordCount} mots** · Mode : ${output.mode}`,
    '',
    '---',
    '',
    output.bodyContent,
  ];

  if (output.clusterArchitecture) {
    lines.push('', '---', '', '### Architecture Topic Cluster');
    lines.push(`**Pillar** : ${output.clusterArchitecture.pillarTopic} (${output.clusterArchitecture.pillarWordCount} words)`);
    lines.push(`**Satellites** : ${output.clusterArchitecture.satellites.length} articles`);
    for (const sat of output.clusterArchitecture.satellites.slice(0, 5)) {
      lines.push(`- [${sat.publishOrder}] ${sat.topic} — ${sat.format} (${sat.estimatedWordCount} words)`);
    }
    lines.push(`**Internal linking** : ${output.clusterArchitecture.internalLinkingLogic}`);
  }

  if (output.editorialCalendar && output.editorialCalendar.length > 0) {
    lines.push('', '### Editorial calendar');
    for (const entry of output.editorialCalendar.slice(0, 8)) {
      lines.push(`- **${entry.publishDate}** — ${entry.topic} (${entry.format})`);
    }
    if (output.editorialCalendar.length > 8) {
      lines.push(`  _+ ${output.editorialCalendar.length - 8} articles planned_`);
    }
  }

  if (output.wpDraftUrl) {
    lines.push('');
    lines.push(`> CMS draft created: [Edit draft](${output.wpDraftUrl})`);
  }

  return lines.join('\n');
}
