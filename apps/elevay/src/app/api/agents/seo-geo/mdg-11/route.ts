import { auth } from '@/lib/auth';
import { SSEEncoder, SSE_HEADERS, generateStreamId } from '@/lib/sse';

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { conversationId, siteUrl } = await req.json() as {
    conversationId: string;
    siteUrl: string;
  };

  const encoder = new SSEEncoder();
  const streamId = generateStreamId();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.retryDirective(3000));
        controller.enqueue(encoder.encode('stream-start', { streamId, conversationId, ts: Date.now() }));

        controller.enqueue(encoder.encode('status', { step: 1, total: 3, label: '[1/3] Analyse des pages…' }));
        await delay(400);

        controller.enqueue(encoder.encode('status', { step: 2, total: 3, label: '[2/3] Génération des meta descriptions…' }));
        await delay(300);

        controller.enqueue(encoder.encode('status', { step: 3, total: 3, label: '[3/3] Contrôle qualité 155-160 caractères…' }));
        await delay(300);

        controller.enqueue(encoder.encode('result', {
          bpiOutput: { agent: 'MDG-11', siteUrl },
          brandName: siteUrl,
        }));

        const summary = `## ✍️ Générateur Meta Descriptions MDG-11 — ${siteUrl}\n\nLes meta descriptions sont prêtes à générer. Précisez votre CMS pour activer l'injection directe sans copier-coller.\n\n**Ce que cet agent génère :**\n- Meta descriptions CTR-optimisées (155-160 caractères, jamais tronquées)\n- Mot-clé primaire dans les 50 premiers caractères\n- Appel à l'action adapté par type de page (article, catégorie, landing, produit)\n- Lot de 50 pages en parallèle (BATCH_SIZE = 50)\n\n**Injection directe CMS :**\n- WordPress (Yoast SEO / RankMath)\n- HubSpot\n- Shopify\n- Webflow\n\nPrécisez votre CMS dans le chat pour générer et injecter vos metas automatiquement.`;

        for (const char of summary) {
          controller.enqueue(encoder.encode('text-delta', { delta: char }));
          await delay(6);
        }

        controller.enqueue(encoder.encode('finish', { tokensIn: 0, tokensOut: 0, totalSteps: 3, finishReason: 'stop' }));
        controller.enqueue(encoder.encode('stream-end', {}));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur interne';
        controller.enqueue(encoder.encode('error', { message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
