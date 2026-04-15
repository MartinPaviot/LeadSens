import { auth } from '@/lib/auth';
import { SSEEncoder, SSE_HEADERS, generateStreamId } from '@/lib/sse';
import { agentRouteSchema } from '@/lib/schemas/seo-routes';
import { checkRateLimit } from '@/lib/rate-limit';
import type { AgentContext } from '../../../../../../core/types';
import { activate } from '../../../../../../agents/seo-geo/pio05';
import type { Pio05Inputs, Pio05Output } from '../../../../../../agents/seo-geo/pio05/types';

export const dynamic = 'force-dynamic'

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  // Rate limit
  const rl = await checkRateLimit(session.user.id, 'pio-05');
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

  const inputs: Pio05Inputs = {
    siteUrl,
    targetKeywords: [],
    geoTargets: profile.targetGeos,
    competitorUrls: [],
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
        controller.enqueue(encoder.encode('status', { step: 2, total: 4, label: '[2/4] Score de citabilité LLM…' }));
        const agentSession = await activate(context, inputs);
        controller.enqueue(encoder.encode('status', { step: 3, total: 4, label: '[3/4] Intelligence concurrentielle…' }));
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
        controller.enqueue(encoder.encode('error', { message: 'Une erreur est survenue.' }));
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
      `## Intelligence SEO & GEO PIO-05 — ${siteUrl}`,
      '',
      'Analysis not available. Connect **Google Search Console** to enable the full dashboard.',
    ].join('\n');
  }

  const lines: string[] = [
    `## Intelligence SEO & GEO — ${siteUrl}`,
    '',
    `**Score global : ${output.dualDashboard.overallScore}/100** (SEO: ${output.dualDashboard.seoScore} · GEO: ${output.dualDashboard.geoScore})`,
    `**LLM Citabilité : ${output.llmCitabilityScore.total}/100**`,
    '',
  ];

  lines.push('### Visibilité par canal');
  for (const channel of output.dualDashboard.channels) {
    lines.push(`- **${channel.channel}** — Score ${channel.score} (${channel.trend})`);
    if (channel.notes) lines.push(`  ${channel.notes}`);
  }
  lines.push('');

  if (output.llmCitabilityScore.axes.length > 0) {
    lines.push('### Score LLM Citabilité (4 axes)');
    for (const axis of output.llmCitabilityScore.axes) {
      lines.push(`- **${axis.axis}** — ${axis.score}/${Math.round(axis.weight * 100)} pts`);
      if (axis.recommendations.length > 0) {
        lines.push(`  → ${axis.recommendations[0]}`);
      }
    }
    lines.push('');
  }

  if (output.llmStructureAudit.issues.length > 0) {
    lines.push(`### Pages à optimiser pour les LLM (${output.llmStructureAudit.issues.length})`);
    for (const issue of output.llmStructureAudit.issues.slice(0, 5)) {
      lines.push(`- **${issue.priority.toUpperCase()}** ${issue.url} — ${issue.issue}`);
    }
    lines.push('');
  }

  if (output.recommendationsForOpt06.length > 0) {
    lines.push('### Recommandations pour OPT-06');
    for (const rec of output.recommendationsForOpt06.slice(0, 4)) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  // Export links
  lines.push('### Exports');
  if (output.sheetsUrl) {
    lines.push(`- [Ouvrir le Google Sheets](${output.sheetsUrl})`);
  }
  if (output.pdfHtml) {
    lines.push('- Rapport PDF disponible (HTML prêt pour export)');
  }
  if (output.nextRunAt) {
    lines.push(`- Prochain rapport planifié : ${output.nextRunAt.toLocaleDateString?.('fr-FR') ?? String(output.nextRunAt)}`);
  }

  return lines.join('\n');
}
