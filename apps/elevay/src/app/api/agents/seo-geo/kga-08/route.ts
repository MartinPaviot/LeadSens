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

        controller.enqueue(encoder.encode('status', { step: 1, total: 3, label: '[1/3] Recherche de mots-clés…' }));
        await delay(400);

        controller.enqueue(encoder.encode('status', { step: 2, total: 3, label: '[2/3] Scoring GEO et opportunités…' }));
        await delay(300);

        controller.enqueue(encoder.encode('status', { step: 3, total: 3, label: "[3/3] Plan d'action 90 jours…" }));
        await delay(300);

        controller.enqueue(encoder.encode('result', {
          bpiOutput: { agent: 'KGA-08', siteUrl },
          brandName: siteUrl,
        }));

        const summary = `## 📊 Stratégie Mots-Clés KGA-08 — ${siteUrl}\n\nVotre plan stratégique est prêt. Connectez **Google Search Console** pour détecter automatiquement les fruits mûrs — pages en position 4-15 avec le meilleur potentiel de progression.\n\n**Ce que cet agent planifie :**\n- Recherche de mots-clés par intention (commercial, informationnel, transactionnel)\n- Scoring GEO : opportunités locales par ville et région\n- Détection des pages city-landing à créer (position > 100/mois, KD < 40)\n- Plan d'action 90 jours priorisé M1 → M3\n- Carte de clusters thématiques\n\nConnectez GSC dans les paramètres pour activer le plan personnalisé.`;

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
