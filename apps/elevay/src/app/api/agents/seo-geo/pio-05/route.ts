import { SSEEncoder, SSE_HEADERS, generateStreamId } from '@/lib/sse';
import { agentRouteSchema } from '@/lib/schemas/seo-routes';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveSeoContext } from '@/lib/seo-route-helpers';
import type { AgentContext } from '../../../../../../core/types';
import { activate } from '../../../../../../agents/seo-geo/pio05';
import type { Pio05Inputs, Pio05Output } from '../../../../../../agents/seo-geo/pio05/types';

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

  const rl = await checkRateLimit(resolved.session.user.id, 'pio-05');
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

  const competitorUrls = (ctx.settings.competitors ?? []).map((c) => c.url).filter(Boolean);
  const seedKeywords = [ctx.settings.primaryKeyword, ctx.settings.secondaryKeyword]
    .filter((k): k is string => !!k)

  const inputs: Pio05Inputs = {
    siteUrl,
    targetKeywords: seedKeywords,
    geoTargets: profile.targetGeos,
    competitorUrls,
    reportFrequency: 'on-demand',
    gscConnected: profile.connectedTools.gsc,
    gaConnected: profile.connectedTools.ga,
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.retryDirective(3000));
        controller.enqueue(encoder.encode('stream-start', { streamId, conversationId, ts: Date.now() }));

        controller.enqueue(encoder.encode('status', { step: 1, total: 4, label: '[1/4] Dashboard dual SEO + GEO…' }));
        controller.enqueue(encoder.encode('status', { step: 2, total: 4, label: '[2/4] LLM Citability Score…' }));
        const agentSession = await activate(context, inputs);
        controller.enqueue(encoder.encode('status', { step: 3, total: 4, label: '[3/4] Competitive intelligence…' }));
        controller.enqueue(encoder.encode('status', { step: 4, total: 4, label: '[4/4] Exports (PDF + Sheets)…' }));

        controller.enqueue(encoder.encode('result', {
          bpiOutput: { agent: 'PIO-05', siteUrl },
          brandName: siteUrl,
        }));

        const output = agentSession.output as Pio05Output | null;
        const text = formatPio05Report(siteUrl, output);
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

function formatPio05Report(siteUrl: string, output: Pio05Output | null): string {
  if (!output) {
    return [
      `## SEO & GEO Intelligence PIO-05 — ${siteUrl}`,
      '',
      'Analysis not available. Connect **Google Search Console** to enable the full dashboard.',
    ].join('\n');
  }

  const lines: string[] = [
    `## SEO & GEO Intelligence — ${siteUrl}`,
    '',
    `**Overall score: ${output.dualDashboard.overallScore}/100** (SEO: ${output.dualDashboard.seoScore} · GEO: ${output.dualDashboard.geoScore})`,
    `**LLM Citability Score: ${output.llmCitabilityScore.total}/100**`,
    '',
  ];

  lines.push('### Visibility by channel');
  for (const channel of output.dualDashboard.channels) {
    lines.push(`- **${channel.channel}** — Score ${channel.score} (${channel.trend})`);
    if (channel.notes) lines.push(`  ${channel.notes}`);
  }
  lines.push('');

  if (output.llmCitabilityScore.axes.length > 0) {
    lines.push('### LLM Citability Score (4 axes)');
    for (const axis of output.llmCitabilityScore.axes) {
      lines.push(`- **${axis.axis}** — ${axis.score}/${Math.round(axis.weight * 100)} pts`);
      if (axis.recommendations.length > 0) {
        lines.push(`  → ${axis.recommendations[0]}`);
      }
    }
    lines.push('');
  }

  if (output.llmStructureAudit.issues.length > 0) {
    lines.push(`### Pages to optimize for LLMs (${output.llmStructureAudit.issues.length})`);
    for (const issue of output.llmStructureAudit.issues.slice(0, 5)) {
      lines.push(`- **${issue.priority.toUpperCase()}** ${issue.url} — ${issue.issue}`);
    }
    lines.push('');
  }

  if (output.recommendationsForOpt06.length > 0) {
    lines.push('### Recommendations for OPT-06');
    for (const rec of output.recommendationsForOpt06.slice(0, 4)) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  // Export links
  lines.push('### Exports');
  if (output.sheetsUrl) {
    lines.push(`- [Open Google Sheets](${output.sheetsUrl})`);
  }
  if (output.pdfHtml) {
    lines.push('- PDF report available (HTML ready for export)');
  }
  if (output.nextRunAt) {
    lines.push(`- Next scheduled report: ${output.nextRunAt.toLocaleDateString?.('en-US') ?? String(output.nextRunAt)}`);
  }

  return lines.join('\n');
}
