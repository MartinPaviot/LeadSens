import { SSEEncoder, SSE_HEADERS, generateStreamId } from '@/lib/sse';
import { agentRouteSchema } from '@/lib/schemas/seo-routes';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveSeoContext } from '@/lib/seo-route-helpers';
import type { AgentContext } from '../../../../../../core/types';
import {
  auditRankings,
  scoreOpportunities,
  applyAutoCorrections,
  pushCorrections,
  detectAlerts,
} from '../../../../../../agents/seo-geo/opt06/workflow';
import type { Opt06Inputs, Opt06Output } from '../../../../../../agents/seo-geo/opt06/types';

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

  const rl = await checkRateLimit(resolved.session.user.id, 'opt-06');
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

  const inputs: Opt06Inputs = {
    siteUrl,
    targetPages: profile.priorityPages,
    targetKeywords: {},
    competitors: competitorUrls,
    automationLevel: profile.automationLevel,
    geoTargets: profile.targetGeos,
    gscConnected: profile.connectedTools.gsc,
    gaConnected: profile.connectedTools.ga,
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.retryDirective(3000));
        controller.enqueue(encoder.encode('stream-start', { streamId, conversationId, ts: Date.now() }));

        // Step 1 — Audit rankings (async — fetches from GSC/DataForSEO)
        controller.enqueue(encoder.encode('status', { step: 1, total: 4, label: '[1/4] Auditing current rankings…' }));
        const rankings = await auditRankings(inputs, context.clientProfile.id);

        // Step 2 — Score opportunities
        controller.enqueue(encoder.encode('status', { step: 2, total: 4, label: '[2/4] Scoring Impact/Effort…' }));
        const opportunities = scoreOpportunities(rankings, inputs);

        // Step 3 — Build + push corrections
        controller.enqueue(encoder.encode('status', { step: 3, total: 4, label: '[3/4] Applying CMS corrections…' }));
        const correctionsApplied = applyAutoCorrections(opportunities, inputs.automationLevel);
        const correctionsPush = await pushCorrections(
          correctionsApplied,
          inputs.automationLevel,
          profile.cmsType,
          profileOverride?.wordpressCredentials ?? undefined,
          profileOverride?.hubspotCredentials ?? undefined,
          profileOverride?.shopifyCredentials ?? undefined,
          profileOverride?.webflowCredentials ?? undefined,
        );

        // Step 4 — Alerts
        controller.enqueue(encoder.encode('status', { step: 4, total: 4, label: '[4/4] Detecting alerts…' }));
        const alerts = detectAlerts(rankings, []);

        const output: Opt06Output = {
          rankings,
          opportunities,
          correctionsApplied,
          correctionsPush,
          alerts,
          monitoringActive: true,
        };

        controller.enqueue(encoder.encode('result', {
          bpiOutput: { agent: 'OPT-06', siteUrl },
          brandName: siteUrl,
        }));

        const text = formatOpt06Report(siteUrl, output);
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

function formatOpt06Report(siteUrl: string, output: Opt06Output): string {
  if (output.rankings.length === 0) {
    return [
      `## SEO & GEO Optimization OPT-06 — ${siteUrl}`,
      '',
      'No ranking data available. Connect **Google Search Console** to enable position tracking.',
    ].join('\n');
  }

  const lines: string[] = [
    `## SEO & GEO Optimization — ${siteUrl}`,
    '',
    `**${output.rankings.length} pages tracked** · ${output.opportunities.length} opportunities found · ${output.alerts.length} alerts`,
    '',
  ];

  const topOpps = [...output.opportunities]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 8);

  if (topOpps.length > 0) {
    lines.push('### Priority opportunities (Impact/Effort)');
    for (const opp of topOpps) {
      const flag = opp.requiresHumanValidation ? ' — human validation required' : '';
      lines.push(`- **${opp.keyword}** pos. ${opp.currentPosition} · ${opp.optimizationTargets.join(', ')} · score ${opp.priorityScore}${flag}`);
    }
    lines.push('');
  }

  if (output.alerts.length > 0) {
    lines.push(`### Alerts (${output.alerts.length})`);
    for (const alert of output.alerts.slice(0, 5)) {
      lines.push(`- **${alert.severity.toUpperCase()}** ${alert.message}`);
    }
    lines.push('');
  }

  if (output.correctionsPush) {
    const push = output.correctionsPush;
    if (push.applied.length > 0) {
      lines.push(`### Applied corrections to CMS (${push.applied.length})`);
      for (const log of push.applied.slice(0, 5)) {
        lines.push(`- ${log.url} — ${log.target}`);
      }
      lines.push('');
    }
    if (push.pending.length > 0) {
      lines.push(`### Corrections pending validation (${push.pending.length})`);
      for (const log of push.pending.slice(0, 5)) {
        lines.push(`- ${log.url} — ${log.target} — human validation required`);
      }
      lines.push('');
    }
    if (push.failed.length > 0) {
      lines.push(`### Failed corrections (${push.failed.length})`);
      for (const f of push.failed.slice(0, 3)) {
        lines.push(`- ${f.log.url} — ${f.reason}`);
      }
      lines.push('');
    }
    if (push.csvExport) {
      lines.push('> A CSV export of corrections is available for manual application.');
      lines.push('');
    }
  } else if (output.correctionsApplied.length > 0) {
    lines.push(`### Identified corrections (${output.correctionsApplied.length})`);
    for (const log of output.correctionsApplied.slice(0, 5)) {
      lines.push(`- ${log.url} — ${log.target}`);
    }
  }

  return lines.join('\n');
}
