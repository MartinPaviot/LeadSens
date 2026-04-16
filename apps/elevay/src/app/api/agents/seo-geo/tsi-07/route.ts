import { SSEEncoder, SSE_HEADERS, generateStreamId } from '@/lib/sse';
import { agentRouteSchema } from '@/lib/schemas/seo-routes';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveSeoContext } from '@/lib/seo-route-helpers';
import type { AgentContext } from '../../../../../../core/types';
import {
  runCrawl,
  fetchGscData,
  classifyIssues,
  buildReport,
  buildActionPlan,
  pushTsi07Corrections,
} from '../../../../../../agents/seo-geo/tsi07/workflow';
import type { Tsi07Inputs, TechnicalAuditReport, ActionPlan, Tsi07CorrectionResult } from '../../../../../../agents/seo-geo/tsi07/types';

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

  const rl = await checkRateLimit(resolved.session.user.id, 'tsi-07');
  if (!rl.allowed) {
    return Response.json(
      { error: 'Rate limit exceeded', retryAfter: rl.retryAfter },
      { status: 429 },
    );
  }

  const { profile, siteUrl } = resolved;
  const encoder = new SSEEncoder();
  const streamId = generateStreamId();

  const context: AgentContext = {
    clientProfile: profile,
    sessionId: streamId,
    triggeredBy: 'user',
  };

  const inputs: Tsi07Inputs = {
    siteUrl,
    cmsType: profile.cmsType,
    automationLevel: profile.automationLevel,
    priorityPages: profile.priorityPages,
    alertChannel: profile.alertChannels[0] ?? 'report',
    gscConnected: profile.connectedTools.gsc,
    gaConnected: profile.connectedTools.ga,
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.retryDirective(3000));
        controller.enqueue(encoder.encode('stream-start', { streamId, conversationId, ts: Date.now() }));

        // Step 1 — Crawl
        controller.enqueue(encoder.encode('status', { step: 1, total: 4, label: '[1/4] Crawling site…' }));
        const crawlStep = await runCrawl(inputs);

        // Step 2 — GSC (optional)
        controller.enqueue(encoder.encode('status', { step: 2, total: 4, label: '[2/4] Google Search Console analysis…' }));
        await fetchGscData(inputs, resolved.session.user.id);

        // Step 3 — Classify + report
        controller.enqueue(encoder.encode('status', { step: 3, total: 4, label: '[3/4] Classification and report…' }));
        const crawlResults = crawlStep.data ?? [];
        const issues = classifyIssues(crawlResults);
        const report = buildReport(siteUrl, crawlResults, issues);
        const actionPlan = buildActionPlan(issues);

        // Step 4 — CMS corrections push
        controller.enqueue(encoder.encode('status', { step: 4, total: 4, label: '[4/4] Applying CMS corrections…' }));
        const correctionsPush = await pushTsi07Corrections(
          issues,
          inputs.automationLevel,
          profile.cmsType,
          profileOverride?.wordpressCredentials ?? undefined,
          profileOverride?.hubspotCredentials ?? undefined,
          profileOverride?.shopifyCredentials ?? undefined,
          profileOverride?.webflowCredentials ?? undefined,
        );

        controller.enqueue(encoder.encode('result', {
          bpiOutput: { agent: 'TSI-07', siteUrl },
          brandName: siteUrl,
        }));

        const text = formatTsi07Report(siteUrl, report, actionPlan, crawlStep.status, correctionsPush);
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

function formatTsi07Report(
  siteUrl: string,
  report: TechnicalAuditReport,
  plan: ActionPlan,
  crawlStatus: string,
  correctionsPush?: Tsi07CorrectionResult | null,
): string {
  if (crawlStatus === 'error') {
    return [
      `## Technical Audit TSI-07 — ${siteUrl}`,
      '',
      'Crawl failed — DataForSEO unavailable. Check your `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` environment variables.',
    ].join('\n');
  }

  const lines: string[] = [
    `## Technical Audit — ${siteUrl}`,
    '',
    `**${report.crawlSummary.totalUrls} pages analyzed** — ${report.crawlSummary.indexable} indexable · ${report.crawlSummary.blocked} blocked · ${report.crawlSummary.errors} errors`,
    `Automatable score: **${report.autoFixableCount} corrections** applicable without human validation`,
    '',
  ];

  if (plan.immediate.length > 0) {
    lines.push(`### Critical issues (${plan.immediate.length})`);
    for (const issue of plan.immediate.slice(0, 10)) {
      lines.push(`- **${issue.type}** — ${issue.description}`);
      lines.push(`  → ${issue.recommendedAction}`);
    }
    if (plan.immediate.length > 10) {
      lines.push(`  _+ ${plan.immediate.length - 10} other critical issues_`);
    }
    lines.push('');
  }

  if (plan.thisWeek.length > 0) {
    lines.push(`### Actions this week (${plan.thisWeek.length})`);
    for (const issue of plan.thisWeek.slice(0, 8)) {
      lines.push(`- ${issue.description}`);
    }
    if (plan.thisWeek.length > 8) {
      lines.push(`  _+ ${plan.thisWeek.length - 8} others_`);
    }
    lines.push('');
  }

  if (plan.thisMonth.length > 0) {
    lines.push(`### This month (${plan.thisMonth.length} pages without meta description)`);
    lines.push(`Use **MDG-11** to generate the missing meta descriptions in batch.`);
    lines.push('');
  }

  if (plan.immediate.length === 0 && plan.thisWeek.length === 0 && plan.thisMonth.length === 0) {
    lines.push('### No issues detected');
    lines.push('Your site has no major technical errors. Continue monitoring regularly.');
  }

  // Show correction results
  if (correctionsPush) {
    if (correctionsPush.applied.length > 0) {
      lines.push(`### Applied corrections (${correctionsPush.applied.length})`);
      for (const c of correctionsPush.applied.slice(0, 5)) {
        lines.push(`- ${c.url} — ${c.field}`);
      }
      if (correctionsPush.applied.length > 5) {
        lines.push(`  _+ ${correctionsPush.applied.length - 5} other corrections_`);
      }
      lines.push('');
    }
    if (correctionsPush.pending.length > 0) {
      lines.push(`### Pending validation (${correctionsPush.pending.length})`);
      for (const p of correctionsPush.pending.slice(0, 5)) {
        lines.push(`- ${p.url} — ${p.type}`);
      }
      if (correctionsPush.pending.length > 5) {
        lines.push(`  _+ ${correctionsPush.pending.length - 5} others pending_`);
      }
      lines.push('');
    }
    if (correctionsPush.failed.length > 0) {
      lines.push(`### Failed corrections (${correctionsPush.failed.length})`);
      for (const f of correctionsPush.failed.slice(0, 5)) {
        lines.push(`- ${f.issue.url} — ${f.reason}`);
      }
      lines.push('');
    }
    if (correctionsPush.csvExport) {
      lines.push('> CSV export available for corrections not applied automatically.');
      lines.push('');
    }
  }

  return lines.join('\n');
}
