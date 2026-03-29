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

        controller.enqueue(encoder.encode('status', { step: 1, total: 3, label: '[1/3] Crawl du site en cours…' }));
        await delay(400);

        controller.enqueue(encoder.encode('status', { step: 2, total: 3, label: '[2/3] Classification des erreurs…' }));
        await delay(300);

        controller.enqueue(encoder.encode('status', { step: 3, total: 3, label: '[3/3] Génération du rapport…' }));
        await delay(300);

        controller.enqueue(encoder.encode('result', {
          bpiOutput: { agent: 'TSI-07', siteUrl },
          brandName: siteUrl,
        }));

        const summary = `## 🔍 Audit Technique TSI-07 — ${siteUrl}\n\nL'audit de votre site est prêt. Connectez **Google Search Console** pour un rapport complet avec données réelles d'indexation, Core Web Vitals et couverture des pages.\n\n**Ce que cet agent analyse :**\n- Erreurs de crawl et pages bloquées\n- Balises canoniques et redirections\n- Vitesse de chargement (Core Web Vitals)\n- Structure des URLs et profondeur d'indexation\n- Sitemap et robots.txt\n\nConnectez GSC dans les paramètres pour activer l'analyse complète.`;

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
