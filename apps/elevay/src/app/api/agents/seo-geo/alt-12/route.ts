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

        controller.enqueue(encoder.encode('status', { step: 1, total: 3, label: "[1/3] Détection des images…" }));
        await delay(400);

        controller.enqueue(encoder.encode('status', { step: 2, total: 3, label: '[2/3] Classification produit / héro / déco…' }));
        await delay(300);

        controller.enqueue(encoder.encode('status', { step: 3, total: 3, label: '[3/3] Génération ALT texts WCAG 2.1…' }));
        await delay(300);

        controller.enqueue(encoder.encode('result', {
          bpiOutput: { agent: 'ALT-12', siteUrl },
          brandName: siteUrl,
        }));

        const summary = `## 🖼️ Générateur ALT Texts ALT-12 — ${siteUrl}\n\nLes ALT texts sont prêts à générer. Précisez votre CMS pour l'injection directe sur toutes les images.\n\n**Ce que cet agent génère :**\n- ALT texts SEO + accessibilité (WCAG 2.1 AA)\n- Classification automatique par type d'image :\n  - **Produit** : nom produit + caractéristiques visuelles clés\n  - **Héros / ambiance** : contexte + émotion + marque\n  - **Infographie** : résumé du contenu informationnel\n  - **Décorative** : \`alt=""\` automatiquement (correct WCAG)\n- Lot de 30 images en parallèle (BATCH_SIZE = 30)\n- Longueur 80-120 caractères, mot-clé contextuel intégré\n\n**Injection directe CMS :**\n- WordPress, HubSpot, Shopify, Webflow\n\nPrécisez votre CMS dans le chat pour générer et injecter tous vos ALT texts.`;

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
