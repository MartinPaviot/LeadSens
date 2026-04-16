import { SSEEncoder, SSE_HEADERS, generateStreamId } from '@/lib/sse';
import { kga08RouteSchema } from '@/lib/schemas/seo-routes';
import { checkRateLimit } from '@/lib/rate-limit';
import { NoConfigError, noConfigResponse, requireFields } from '@/lib/agent-context';
import { toKga08Settings } from '@/lib/agent-adapters';
import { resolveSeoContext } from '@/lib/seo-route-helpers';
import type { AgentContext } from '../../../../../../core/types';
import { activate } from '../../../../../../agents/seo-geo/kga08';
import type { Kga08Inputs, Kga08Output } from '../../../../../../agents/seo-geo/kga08/types';

export const dynamic = 'force-dynamic'
export const maxDuration = 60;

export async function POST(req: Request) {
  const parsed = kga08RouteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request body', details: parsed.error.format() }, { status: 400 });
  }
  const { conversationId, siteUrl: siteUrlOverride, profile: profileOverride, seedKeywords } = parsed.data;

  const resolved = await resolveSeoContext(profileOverride, siteUrlOverride);
  if (resolved instanceof Response) return resolved;

  const rl = await checkRateLimit(resolved.session.user.id, 'kga-08');
  if (!rl.allowed) {
    return Response.json({ error: 'Rate limit exceeded', retryAfter: rl.retryAfter }, { status: 429 });
  }

  let kgaSettings: ReturnType<typeof toKga08Settings>['data'];
  try {
    kgaSettings = requireFields(toKga08Settings(resolved.ctx), 'SEO & Site');
  } catch (err) {
    if (err instanceof NoConfigError) return noConfigResponse(err);
    throw err;
  }

  const { profile, siteUrl } = resolved;
  const encoder = new SSEEncoder();
  const streamId = generateStreamId();

  const context: AgentContext = {
    clientProfile: profile,
    sessionId: streamId,
    triggeredBy: 'user',
  };

  const inputs: Kga08Inputs = {
    siteUrl,
    targetPages: profile.priorityPages,
    businessObjective: kgaSettings.businessObjective,
    geoLevel: profile.geoLevel,
    targetGeos: profile.targetGeos,
    competitors: kgaSettings.competitors,
    monthlyContentCapacity: kgaSettings.monthlyContentCapacity,
    seoMaturity: kgaSettings.seoMaturity,
    prioritization: kgaSettings.prioritization,
    gscConnected: profile.connectedTools.gsc,
    multiCountry: profile.targetGeos.length > 1,
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.retryDirective(3000));
        controller.enqueue(encoder.encode('stream-start', { streamId, conversationId, ts: Date.now() }));

        controller.enqueue(encoder.encode('status', { step: 1, total: 3, label: '[1/3] Keyword research in progress…' }));
        controller.enqueue(encoder.encode('status', { step: 2, total: 3, label: '[2/3] GEO scoring and opportunities…' }));
        const parsedSeeds = Array.isArray(seedKeywords)
          ? seedKeywords.filter((k): k is string => typeof k === 'string' && k.trim().length > 0).map((k) => k.trim())
          : [];
        const agentSession = await activate(context, inputs, parsedSeeds);
        controller.enqueue(encoder.encode('status', { step: 3, total: 3, label: '[3/3] 90-day action plan…' }));

        controller.enqueue(encoder.encode('result', {
          bpiOutput: { agent: 'KGA-08', siteUrl },
          brandName: siteUrl,
        }));

        const output = agentSession.output as Kga08Output | { error: string } | null;
        const text = formatKga08Report(siteUrl, output);
        for (const char of text) {
          controller.enqueue(encoder.encode('text-delta', { delta: char }));
        }

        controller.enqueue(encoder.encode('finish', {
          tokensIn: 0, tokensOut: 0, totalSteps: 3, finishReason: 'stop',
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

function formatKga08Report(
  siteUrl: string,
  output: Kga08Output | { error: string } | null,
): string {
  if (!output || 'error' in output) {
    const reason = output && 'error' in output ? output.error : 'Aucune donnée disponible';
    return [
      `## Stratégie Mots-Clés KGA-08 — ${siteUrl}`,
      '',
      `Analysis returned an error: ${reason}`,
      '',
      'Connect **Google Search Console** in settings to enable full keyword analysis.',
    ].join('\n');
  }

  const lines: string[] = [
    `## Keyword Strategy — ${siteUrl}`,
    '',
    `**${output.kwScores.length} keywords analysed** · ${output.cityLandingPages.length} city pages recommended`,
    '',
  ];

  if (output.kwScores.length > 0) {
    lines.push('### Top opportunities (M1)');
    for (const kw of output.actionPlan.month1.slice(0, 8)) {
      lines.push(`- **${kw.keyword}** — potential ${kw.trafficPotential} · difficulty ${kw.seoDifficulty} · ${kw.geo}`);
    }
    lines.push('');
  }

  if (output.geoMarketScores.length > 0) {
    lines.push('### Priority GEO markets');
    for (const geo of output.geoMarketScores.slice(0, 5)) {
      lines.push(`- **${geo.geo}** — Score ${geo.totalScore}/100`);
    }
    lines.push('');
  }

  if (output.cityLandingPages.length > 0) {
    lines.push(`### City landing pages to create (${output.cityLandingPages.length})`);
    for (const page of output.cityLandingPages.slice(0, 5)) {
      lines.push(`- \`${page.recommendedUrl}\` — ${page.keyword} (${page.monthlyVolume}/mo)`);
    }
    lines.push('');
  }

  if (Object.keys(output.clusterMap).length > 0) {
    lines.push('### Topic clusters');
    for (const [cluster, kws] of Object.entries(output.clusterMap).slice(0, 4)) {
      lines.push(`- **${cluster}** (${(kws as unknown[]).length} keywords)`);
    }
  }

  return lines.join('\n');
}
