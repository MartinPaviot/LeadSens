import { auth } from '@/lib/auth';
import { SSEEncoder, SSE_HEADERS, generateStreamId } from '@/lib/sse';
import { agentRouteSchema } from '@/lib/schemas/seo-routes';
import { checkRateLimit } from '@/lib/rate-limit';
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

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  // Rate limit
  const rl = await checkRateLimit(session.user.id, 'tsi-07');
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
        await fetchGscData(inputs, session.user.id);

        // Step 3 — Classify + report
        controller.enqueue(encoder.encode('status', { step: 3, total: 4, label: '[3/4] Classification and report…' }));
        const crawlResults = crawlStep.data ?? [];
        const issues = classifyIssues(crawlResults);
        const report = buildReport(siteUrl, crawlResults, issues);
        const actionPlan = buildActionPlan(issues);

        // Step 4 — CMS corrections push
        controller.enqueue(encoder.encode('status', { step: 4, total: 4, label: '[4/4] Application des corrections CMS…' }));
        const correctionsPush = await pushTsi07Corrections(
          issues,
          inputs.automationLevel,
          profile.cmsType,
          profile.wordpressCredentials ?? undefined,
          profile.hubspotCredentials ?? undefined,
          profile.shopifyCredentials ?? undefined,
          profile.webflowCredentials ?? undefined,
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
        console.error('[tsi-07]', err);
        controller.enqueue(encoder.encode('error', { message: 'Une erreur est survenue.' }));
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
      `## Audit Technique TSI-07 — ${siteUrl}`,
      '',
      'Crawl failed — DataForSEO unavailable. Check your `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` environment variables.',
    ].join('\n');
  }

  const lines: string[] = [
    `## Audit Technique — ${siteUrl}`,
    '',
    `**${report.crawlSummary.totalUrls} pages analysées** — ${report.crawlSummary.indexable} indexables · ${report.crawlSummary.blocked} bloquées · ${report.crawlSummary.errors} erreurs`,
    `Score automatisable : **${report.autoFixableCount} corrections** applicables sans validation humaine`,
    '',
  ];

  if (plan.immediate.length > 0) {
    lines.push(`### Problèmes critiques (${plan.immediate.length})`);
    for (const issue of plan.immediate.slice(0, 10)) {
      lines.push(`- **${issue.type}** — ${issue.description}`);
      lines.push(`  → ${issue.recommendedAction}`);
    }
    if (plan.immediate.length > 10) {
      lines.push(`  _+ ${plan.immediate.length - 10} autres problèmes critiques_`);
    }
    lines.push('');
  }

  if (plan.thisWeek.length > 0) {
    lines.push(`### Actions cette semaine (${plan.thisWeek.length})`);
    for (const issue of plan.thisWeek.slice(0, 8)) {
      lines.push(`- ${issue.description}`);
    }
    if (plan.thisWeek.length > 8) {
      lines.push(`  _+ ${plan.thisWeek.length - 8} autres_`);
    }
    lines.push('');
  }

  if (plan.thisMonth.length > 0) {
    lines.push(`### Ce mois (${plan.thisMonth.length} pages sans meta description)`);
    lines.push(`Utilisez **MDG-11** pour générer les meta descriptions manquantes en lot.`);
    lines.push('');
  }

  if (plan.immediate.length === 0 && plan.thisWeek.length === 0 && plan.thisMonth.length === 0) {
    lines.push('### Aucun problème détecté');
    lines.push('Votre site ne présente pas d\'erreurs techniques majeures. Continuez à surveiller régulièrement.');
  }

  // Show correction results
  if (correctionsPush) {
    if (correctionsPush.applied.length > 0) {
      lines.push(`### Corrections appliquées (${correctionsPush.applied.length})`);
      for (const c of correctionsPush.applied.slice(0, 5)) {
        lines.push(`- ${c.url} — ${c.field}`);
      }
      if (correctionsPush.applied.length > 5) {
        lines.push(`  _+ ${correctionsPush.applied.length - 5} autres corrections_`);
      }
      lines.push('');
    }
    if (correctionsPush.pending.length > 0) {
      lines.push(`### En attente de validation (${correctionsPush.pending.length})`);
      for (const p of correctionsPush.pending.slice(0, 5)) {
        lines.push(`- ${p.url} — ${p.type}`);
      }
      if (correctionsPush.pending.length > 5) {
        lines.push(`  _+ ${correctionsPush.pending.length - 5} autres en attente_`);
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
      lines.push('> Export CSV disponible pour les corrections non appliquées automatiquement.');
      lines.push('');
    }
  }

  return lines.join('\n');
}
