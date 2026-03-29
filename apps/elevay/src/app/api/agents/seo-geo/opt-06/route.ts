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

        controller.enqueue(encoder.encode('status', { step: 1, total: 3, label: '[1/3] Audit ranking actuel…' }));
        await delay(400);

        controller.enqueue(encoder.encode('status', { step: 2, total: 3, label: '[2/3] Scoring Impact / Effort…' }));
        await delay(300);

        controller.enqueue(encoder.encode('status', { step: 3, total: 3, label: '[3/3] Identification des optimisations…' }));
        await delay(300);

        controller.enqueue(encoder.encode('result', {
          bpiOutput: { agent: 'OPT-06', siteUrl },
          brandName: siteUrl,
        }));

        const summary = `## 🚀 Optimiseur SEO OPT-06 — ${siteUrl}\n\nL'analyse des opportunités est prête. Connectez **Google Search Console** pour activer le scoring automatique Impact/Effort sur vos vraies positions.\n\n**Ce que cet agent optimise :**\n- Pages en position 4-15 (fruits mûrs à haute priorité)\n- Corrections automatiques : balises title, meta descriptions, Hn\n- Détection des baisses de ranking (alertes -3 positions / 7 jours)\n- Monitoring continu des positions stratégiques\n- Rapport hebdomadaire d'opportunités\n\n⚠️ Pages > 1 000 visites/mois : validation humaine obligatoire avant toute correction.\n\nConnectez GSC dans les paramètres pour activer l'optimisation automatique.`;

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
