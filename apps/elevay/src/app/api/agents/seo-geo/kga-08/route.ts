import { auth } from '@/lib/auth';
import { SSEEncoder, SSE_HEADERS, generateStreamId } from '@/lib/sse';
import { kga08RouteSchema } from '@/lib/schemas/seo-routes';
import { checkRateLimit } from '@/lib/rate-limit';
import type { AgentContext } from '../../../../../../core/types';
import { activate } from '../../../../../../agents/seo-geo/kga08';
import type { Kga08Inputs, Kga08Output } from '../../../../../../agents/seo-geo/kga08/types';

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  // Rate limit
  const rl = await checkRateLimit(session.user.id, 'kga-08');
  if (!rl.allowed) {
    return Response.json(
      { error: 'Rate limit exceeded', retryAfter: rl.retryAfter },
      { status: 429 },
    );
  }

  const parsed = kga08RouteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request body', details: parsed.error.format() }, { status: 400 });
  }
  const { conversationId, siteUrl, profile, seedKeywords } = parsed.data;

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

  const inputs: Kga08Inputs = {
    siteUrl,
    targetPages: profile.priorityPages,
    businessObjective: 'traffic',
    geoLevel: profile.geoLevel,
    targetGeos: profile.targetGeos,
    competitors: [],
    monthlyContentCapacity: 4,
    seoMaturity: 'beginner',
    prioritization: 'volume',
    gscConnected: profile.connectedTools.gsc,
    multiCountry: profile.targetGeos.length > 1,
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.retryDirective(3000));
        controller.enqueue(encoder.encode('stream-start', { streamId, conversationId, ts: Date.now() }));

        controller.enqueue(encoder.encode('status', { step: 1, total: 3, label: '[1/3] Recherche de mots-clés en cours…' }));
        // Optimistic status — activate() handles its own step sequencing
        controller.enqueue(encoder.encode('status', { step: 2, total: 3, label: '[2/3] Scoring GEO et opportunités…' }));
        const parsedSeeds = Array.isArray(seedKeywords)
          ? seedKeywords.filter((k): k is string => typeof k === 'string' && k.trim().length > 0).map((k) => k.trim())
          : [];
        const agentSession = await activate(context, inputs, parsedSeeds);
        controller.enqueue(encoder.encode('status', { step: 3, total: 3, label: "[3/3] Plan d'action 90 jours…" }));

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
          tokensIn: 0,
          tokensOut: 0,
          totalSteps: 3,
          finishReason: 'stop',
        }));
        controller.enqueue(encoder.encode('stream-end', {}));
      } catch (err) {
        console.error('[kga-08]', err);
        controller.enqueue(encoder.encode('error', { message: 'Une erreur est survenue.' }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

// ─── Output formatter ─────────────────────────────────────

function formatKga08Report(
  siteUrl: string,
  output: Kga08Output | { error: string } | null,
): string {
  if (!output || 'error' in output) {
    const reason = output && 'error' in output ? output.error : 'Aucune donnée disponible';
    return [
      `## Stratégie Mots-Clés KGA-08 — ${siteUrl}`,
      '',
      `L'analyse a retourné une erreur : ${reason}`,
      '',
      'Connectez **Google Search Console** dans les paramètres pour activer l\'analyse complète des mots-clés.',
    ].join('\n');
  }

  const lines: string[] = [
    `## Stratégie Mots-Clés — ${siteUrl}`,
    '',
    `**${output.kwScores.length} mots-clés analysés** · ${output.cityLandingPages.length} city pages recommandées`,
    '',
  ];

  if (output.kwScores.length > 0) {
    lines.push('### Top opportunités (M1)');
    for (const kw of output.actionPlan.month1.slice(0, 8)) {
      lines.push(`- **${kw.keyword}** — potentiel ${kw.trafficPotential} · difficulté ${kw.seoDifficulty} · ${kw.geo}`);
    }
    lines.push('');
  }

  if (output.geoMarketScores.length > 0) {
    lines.push('### Marchés GEO prioritaires');
    for (const geo of output.geoMarketScores.slice(0, 5)) {
      lines.push(`- **${geo.geo}** — Score ${geo.totalScore}/100`);
    }
    lines.push('');
  }

  if (output.cityLandingPages.length > 0) {
    lines.push(`### City landing pages à créer (${output.cityLandingPages.length})`);
    for (const page of output.cityLandingPages.slice(0, 5)) {
      lines.push(`- \`${page.recommendedUrl}\` — ${page.keyword} (${page.monthlyVolume}/mois)`);
    }
    lines.push('');
  }

  if (Object.keys(output.clusterMap).length > 0) {
    lines.push('### Clusters thématiques');
    for (const [cluster, kws] of Object.entries(output.clusterMap).slice(0, 4)) {
      lines.push(`- **${cluster}** (${(kws as unknown[]).length} mots-clés)`);
    }
  }

  return lines.join('\n');
}
