import { auth } from '@/lib/auth';
import { SSEEncoder, SSE_HEADERS, generateStreamId } from '@/lib/sse';
import { agentRouteSchema } from '@/lib/schemas/seo-routes';
import { checkRateLimit } from '@/lib/rate-limit';
import type { AgentContext } from '../../../../../../core/types';
import { activate } from '../../../../../../agents/seo-geo/alt12';
import type { Alt12Inputs, Alt12Output } from '../../../../../../agents/seo-geo/alt12/types';

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  // Rate limit
  const rl = await checkRateLimit(session.user.id, 'alt-12');
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

  const inputs: Alt12Inputs = {
    siteUrl,
    scope: 'all',
    cmsType: profile.cmsType,
    brandTone: 'descriptive',
    language: 'fr',
    variationsCount: 2,
    inject: false,
  };

  const wpCreds = profile.wordpressCredentials;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.retryDirective(3000));
        controller.enqueue(encoder.encode('stream-start', { streamId, conversationId, ts: Date.now() }));

        let text: string;

        if (wpCreds && profile.cmsType === 'wordpress') {
          controller.enqueue(encoder.encode('status', { step: 1, total: 4, label: '[1/4] Crawl des images WordPress…' }));
          const { wpGetImages } = await import('../../../../../../core/tools/cms/wordpress');
          const images = await wpGetImages(wpCreds).catch(() => []);

          controller.enqueue(encoder.encode('status', { step: 2, total: 4, label: `[2/4] ${images.length} images détectées…` }));
          const imageList = images.map((img) => ({
            url: img.url,
            pageUrl: profile.siteUrl,
            pageTitle: '',
            currentAlt: img.altText,
            filename: img.filename,
          }));

          controller.enqueue(encoder.encode('status', { step: 3, total: 4, label: '[3/4] Classification produit / héro / déco…' }));
          controller.enqueue(encoder.encode('status', { step: 4, total: 4, label: '[4/4] Génération ALT texts WCAG 2.1…' }));
          const agentSession = await activate(context, inputs, imageList, wpCreds ?? undefined, profile.hubspotCredentials ?? undefined, profile.shopifyCredentials ?? undefined, profile.webflowCredentials ?? undefined);

          controller.enqueue(encoder.encode('result', {
            bpiOutput: { agent: 'ALT-12', siteUrl },
            brandName: siteUrl,
          }));

          const output = agentSession.output as Alt12Output | { error: string } | null;
          text = formatAlt12Report(siteUrl, output, profile.cmsType);
        } else {
          controller.enqueue(encoder.encode('result', {
            bpiOutput: { agent: 'ALT-12', siteUrl },
            brandName: siteUrl,
          }));

          text = [
            `**ALT-12 — Mode export**`,
            ``,
            profile.cmsType === 'wordpress'
              ? `Credentials WordPress non renseignés. Ajoutez-les dans l'onboarding pour l'injection directe.`
              : profile.cmsType === 'hubspot'
                ? `Credentials HubSpot non renseignés. Ajoutez-les dans l'onboarding pour l'injection directe.`
                : profile.cmsType === 'shopify'
                  ? `Credentials Shopify non renseignés. Ajoutez-les dans l'onboarding pour l'injection directe.`
                  : profile.cmsType === 'webflow'
                    ? `Credentials Webflow non renseignés. Ajoutez-les dans l'onboarding pour l'injection directe.`
                    : `Connexion ${profile.cmsType} via les paramètres requise pour l'injection directe.`,
            ``,
            `L'export CSV reste disponible après analyse.`,
          ].join('\n');
        }

        for (const char of text) {
          controller.enqueue(encoder.encode('text-delta', { delta: char }));
        }

        controller.enqueue(encoder.encode('finish', {
          tokensIn: 0,
          tokensOut: 0,
          totalSteps: wpCreds && profile.cmsType === 'wordpress' ? 4 : 1,
          finishReason: 'stop',
        }));
        controller.enqueue(encoder.encode('stream-end', {}));
      } catch (err) {
        console.error('[alt-12]', err);
        controller.enqueue(encoder.encode('error', { message: 'Une erreur est survenue.' }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

// ─── Output formatter ─────────────────────────────────────

function formatAlt12Report(
  siteUrl: string,
  output: Alt12Output | { error: string } | null,
  cmsType: string,
): string {
  // Graceful degradation: WordPress credentials not yet configured
  if (!output || 'error' in output) {
    return [
      `## Générateur ALT Texts ALT-12 — ${siteUrl}`,
      '',
      'Pour générer les ALT texts de vos images, connectez votre CMS dans les paramètres.',
      '',
      '**Ce que cet agent génère :**',
      '- ALT texts SEO + accessibilité (WCAG 2.1 AA)',
      '- Classification automatique : produit · héros · infographie · décorative',
      '- Lot de 30 images en parallèle',
      '- 80-120 caractères, mot-clé contextuel intégré',
      '',
      `**CMS détecté : ${cmsType}**`,
      cmsType === 'wordpress'
        ? 'Configurez vos identifiants WordPress (Application Password) dans les paramètres pour activer l\'injection directe.'
        : `Configurez votre connexion ${cmsType} via les paramètres OAuth pour activer l'injection directe.`,
    ].join('\n');
  }

  const { results, qualityReport } = output;

  const lines: string[] = [
    `## ALT Texts — ${siteUrl}`,
    '',
    `**${results.length} images traitées** · ${qualityReport.valid} valides · ${qualityReport.invalid} à revoir`,
    '',
  ];

  if (results.length > 0) {
    lines.push('### Exemples générés');
    for (const result of results.slice(0, 5)) {
      const best = result.variations[0];
      if (best) {
        lines.push(`**${result.imageUrl}**`);
        lines.push(`> ${best.text} _(${result.imageType})_`);
        lines.push('');
      }
    }
  }

  lines.push('Pour injecter ces ALT texts directement dans votre CMS, configurez la connexion dans les paramètres.');

  return lines.join('\n');
}
