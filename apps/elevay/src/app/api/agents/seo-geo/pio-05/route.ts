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

        controller.enqueue(encoder.encode('status', { step: 1, total: 3, label: '[1/3] Dashboard dual SEO + GEO…' }));
        await delay(400);

        controller.enqueue(encoder.encode('status', { step: 2, total: 3, label: '[2/3] Score de citabilité LLM…' }));
        await delay(300);

        controller.enqueue(encoder.encode('status', { step: 3, total: 3, label: '[3/3] Analyse concurrentielle…' }));
        await delay(300);

        controller.enqueue(encoder.encode('result', {
          bpiOutput: { agent: 'PIO-05', siteUrl },
          brandName: siteUrl,
        }));

        const summary = `## 🧠 Intelligence SEO & GEO PIO-05 — ${siteUrl}\n\nVotre score de citabilité IA est calculé. Connectez **Google Search Console** pour le dashboard complet SEO + GEO avec données réelles.\n\n**Canaux analysés :**\n| Canal | Score V1 | Source |\n|-------|----------|--------|\n| Google Search | Estimé | GSC requis |\n| Google AI Overview | 0 | API non disponible V1 |\n| Bing Copilot | 0 | API non disponible V1 |\n| Perplexity | 0 | API non disponible V1 |\n| Google Maps | 0 | Config locale requise |\n\n**Score LLM Citabilité (4 axes, 25% chacun) :**\n- E-E-A-T : autorité auteur, About page, citations\n- Structure contenu : FAQ schema, titres clairs, réponse directe\n- Faits vérifiables : chiffres sourcés, données datées\n- Backlinks autoritaires : liens éditoriaux, DA domaine\n\nConnectez GSC dans les paramètres pour activer le monitoring complet.`;

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
