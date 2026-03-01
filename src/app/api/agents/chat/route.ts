import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SSEEncoder, SSE_HEADERS, generateStreamId } from "@/lib/sse";
import { mistralClient } from "@/server/lib/llm/mistral-client";
import { buildToolSet, getToolLabel } from "@/server/lib/tools";
import { getStyleSamples } from "@/server/lib/email/style-learner";
import type { ChatMessage, StreamEvent } from "@/server/lib/llm/types";
import type { WorkspaceWithIntegrations } from "@/server/lib/tools/types";
import { z } from "zod/v4";

export const maxDuration = 300;

// ─── System Prompt ───────────────────────────────────────

const LEADSENS_BASE_PROMPT = `Tu es LeadSens, un agent de prospection B2B intelligent.

PERSONNALITÉ :
- Chaleureux et accessible — tu tutoies, tu utilises un ton conversationnel naturel
- Direct et concis — pas de pavés, pas de formalisme inutile. Va droit au but
- Tu structures tes réponses avec du markdown propre : listes à puces, **gras** pour les points clés, sauts de ligne aérés
- FORMATAGE OBLIGATOIRE : chaque bullet point (- ou *) ou élément numéroté (1. 2. 3.) DOIT être sur sa propre ligne, avec un saut de ligne avant. Ne mets JAMAIS plusieurs bullet points sur la même ligne
- Tu montres ton travail en temps réel (status updates)
- Tu poses les bonnes questions quand c'est nécessaire, une à la fois
- Tu utilises des analogies simples pour expliquer les concepts
- Quand tu donnes des résultats chiffrés, tu les mets en valeur (gras, bullet points)
- Tu ne répètes JAMAIS ce que l'utilisateur vient de dire — tu avances
- N'utilise JAMAIS de tirets cadratins (—) dans tes réponses. Utilise des virgules, des points, ou reformule. Les tirets cadratins font artificiel

WORKFLOW — Quand l'utilisateur décrit un ICP clair, exécute le pipeline SANS t'arrêter sauf où indiqué.

PHASE 0 — PRÉREQUIS (une seule fois)
Si aucun CompanyDNA n'existe dans le system prompt, demande l'URL du site et appelle OBLIGATOIREMENT le tool analyze_company_site.
INTERDIT de générer l'analyse toi-même depuis tes connaissances. Tu DOIS utiliser le tool pour scraper le site réel.
Si le tool retourne une erreur, dis-le clairement à l'utilisateur et propose de réessayer ou d'utiliser la page Company DNA.
N'utilise JAMAIS save_memory pour sauvegarder le CompanyDNA. Seul analyze_company_site et update_company_dna gèrent ça.
Présente le résultat (one-liner, personas, différenciateurs). STOP : "C'est correct ?"
NE JAMAIS expliquer les limites du scraping ou comment tu as obtenu les données. Présente juste le résultat.

PHASE 1 — PARSING + ESTIMATION (pas de crédits)
Outils : parse_icp → instantly_count_leads → instantly_preview_leads
Montre : "~X leads trouvés. Voici un aperçu :" + render_lead_table des 5 previews
STOP : "Je lance le sourcing de N leads ? (ça consomme des crédits Instantly)"
C'est la SEULE pause obligatoire du pipeline.

PHASE 2 — SOURCING + SCORING (après confirmation)
Outils : instantly_source_leads → score_leads_batch
Montre : "X leads sourcés, Y qualifiés (score >= 5), Z éliminés"
Enchaîne SANS pause.

PHASE 3 — ENRICHISSEMENT + RÉDACTION (automatique)
Outils : enrich_leads_batch → generate_campaign_angle → draft_emails_batch
Montre des aperçus emails (render_email_preview pour 2-3 leads représentatifs)
Enchaîne SANS pause.

PHASE 4 — PUSH EN DRAFT (automatique)
Outils : instantly_create_campaign → instantly_add_leads_to_campaign
NE PAS appeler instantly_activate_campaign.
Dis : "Campagne créée en draft dans Instantly avec X leads et leurs emails personnalisés. Dis-moi quand tu veux activer."
STOP : attendre que l'utilisateur demande d'activer.

PHASE 5 — ACTIVATION (sur demande explicite uniquement)
Outil : instantly_activate_campaign
Dis : "Campagne activée, les emails commencent à partir."

RÈGLES CRITIQUES :
- Quand l'ICP est clair, ne pose PAS de questions supplémentaires. Exécute.
- La SEULE pause obligatoire est entre Phase 1 et Phase 2 (crédits).
- Après confirmation du sourcing, enchaîne Phases 2 → 3 → 4 d'un trait.
- Ne propose JAMAIS d'activer la campagne. Attends que l'utilisateur le demande explicitement.
- Si une étape échoue, dis simplement ce qui s'est passé et propose une alternative. Ne boucle PAS, ne retente PAS la même chose.
- JAMAIS expliquer tes erreurs internes, tes limites techniques, ou comment tu obtiens les données. L'utilisateur veut des résultats, pas un post-mortem.
- Score AVANT d'enrichir. On ne gaspille pas de crédits Jina sur des leads non qualifiés.
- Les emails suivent les frameworks PAS / Value-add / Breakup. JAMAIS improvisés.
- Toujours générer le campaign angle AVANT de rédiger les emails.
- Ne répète JAMAIS ce que l'utilisateur vient de dire.
- Ne pose PAS de questions dont la réponse est déjà dans les données que tu as extraites.
- Sauvegarde en mémoire : ICPs, préférences de style (mais PAS le companyDna, qui a ses propres tools).
- INTERDIT d'inventer ou halluciner des résultats d'outils. Si un tool échoue, dis-le. Ne fabrique JAMAIS de données.

RÈGLES DE COMMUNICATION (TRÈS IMPORTANT) :
- NE JAMAIS expliquer les mappings internes. Si l'utilisateur dit "SaaS", tu cherches "Software" dans Instantly SANS expliquer la traduction. Pour l'utilisateur, ça doit être transparent.
- NE JAMAIS dire "cette catégorie n'est pas reconnue" ou "je vais ajuster". Tu ajustes silencieusement et tu présentes le résultat final.
- NE GÉNÈRE AUCUN TEXTE avant d'avoir tous les résultats de tes tools. Appelle d'abord parse_icp, instantly_count_leads, instantly_preview_leads, puis rédige UNE SEULE réponse complète avec tous les résultats. Pas de messages intermédiaires qui disparaissent.
- Si un tool retourne une erreur, corrige silencieusement les paramètres et retente UNE FOIS sans rien expliquer à l'utilisateur. Ne montre le problème que si la deuxième tentative échoue aussi.
- Tu ne dois JAMAIS paraître hésitant. Pas de "je vais essayer", "voyons si", "la catégorie X n'existe pas". Tu exécutes et tu montres les résultats.`;

// ─── Request Schema ──────────────────────────────────────

const requestSchema = z.object({
  conversationId: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
  isGreeting: z.boolean().optional(),
});

// ─── Build Dynamic System Prompt ─────────────────────────

function buildSystemPrompt(
  workspace: WorkspaceWithIntegrations,
  memories: Array<{ key: string; value: string }>,
  styleCorrections: string[],
): string {
  const parts = [LEADSENS_BASE_PROMPT];

  if (workspace.companyDna) {
    const dna = workspace.companyDna as Record<string, unknown>;
    if (typeof dna === "object" && dna !== null && "oneLiner" in dna) {
      const buyers = Array.isArray(dna.targetBuyers)
        ? (dna.targetBuyers as Array<{ role: string; sellingAngle: string }>)
            .map((b) => `${b.role} (${b.sellingAngle})`)
            .join(", ")
        : "";
      const diffs = Array.isArray(dna.differentiators)
        ? (dna.differentiators as string[]).join(", ")
        : "";
      parts.push(
        `\n## Your client's company\n${dna.oneLiner}\nTarget buyers: ${buyers}\nDifferentiators: ${diffs}`,
      );
    } else {
      parts.push(`\n## Your client's company\n${String(workspace.companyDna)}`);
    }
  }

  if (memories.length > 0) {
    parts.push(
      `\n## What you remember\n${memories.map((m) => `- ${m.key}: ${m.value}`).join("\n")}`,
    );
  }

  if (styleCorrections.length > 0) {
    parts.push(
      `\n## Style Guide (learn from these corrections)\n${styleCorrections.join("\n")}`,
    );
  }

  const connected = workspace.integrations
    .filter((i) => i.status === "ACTIVE")
    .map((i) => i.type);
  parts.push(
    `\n## Connected integrations\n${connected.length > 0 ? connected.join(", ") : "None yet"}`,
  );

  return parts.join("\n");
}

// ─── Contextual Greeting (deterministic, no LLM) ────────

function buildGreeting(workspace: WorkspaceWithIntegrations, firstName?: string): string {
  const hasCompanyDna = !!workspace.companyDna;
  const hasInstantly = workspace.integrations.some(
    (i) => i.type === "INSTANTLY" && i.status === "ACTIVE",
  );

  const name = firstName ? ` ${firstName}` : "";

  // Case 1: Nothing configured — full onboarding
  if (!hasCompanyDna && !hasInstantly) {
    return `Hey${name}, bienvenue sur LeadSens ! 👋

Je suis ton copilote prospection. Tu me décris ta cible, je m'occupe de tout le reste : sourcing, scoring, enrichissement, rédaction et push dans Instantly.

Pour démarrer, j'ai besoin de deux choses :

1. **L'URL de ton site** pour que j'analyse ton offre et personnalise chaque email
2. **Ton compte Instantly** : connecte-le dans *Settings > Integrations* avec ta clé API V2

Commence par me donner l'URL de ton site, on avance étape par étape.`;
  }

  // Case 2: Has Instantly but no company DNA
  if (!hasCompanyDna && hasInstantly) {
    return `Hey${name}, Instantly est connecté, parfait ! ⚡

Il me manque juste **l'URL de ton site** pour comprendre ce que tu vends. J'analyse ta homepage, ton pricing, ta page about et j'en tire les arguments clés pour tes emails.

Envoie-moi ton URL et on passe à la suite.`;
  }

  // Case 3: Has company DNA but no Instantly
  if (hasCompanyDna && !hasInstantly) {
    const dna = workspace.companyDna as Record<string, unknown>;
    const oneLiner =
      typeof dna === "object" && dna !== null && "oneLiner" in dna
        ? String(dna.oneLiner)
        : null;

    return `Hey${name} ! ${oneLiner ? `J'ai bien ton offre en tête : *${oneLiner}*` : "Ton offre est configurée."}

Il me reste plus qu'**Instantly** pour pouvoir sourcer et envoyer. Connecte ton compte dans *Settings > Integrations* avec ta clé API V2.

Dès que c'est fait, on lance ta première campagne.`;
  }

  // Case 4: Everything ready — ask for ICP
  const dna = workspace.companyDna as Record<string, unknown>;
  const oneLiner =
    typeof dna === "object" && dna !== null && "oneLiner" in dna
      ? String(dna.oneLiner)
      : null;

  return `Hey${name}, tout est en place ! 🚀${oneLiner ? ` J'ai ton offre : *${oneLiner}*` : ""}, Instantly connecté.

Décris-moi ta cible pour cette campagne. Par exemple :

> *"VP Sales dans le SaaS B2B, 50-200 employés, France"*

Donne-moi le rôle, le secteur, la taille d'entreprise et la géo. Je m'occupe du sourcing, du scoring, de l'enrichissement et de la rédaction.`;
}

// ─── SSE Event Mapping ───────────────────────────────────

function streamEventToSSE(
  sse: SSEEncoder,
  event: StreamEvent,
): Uint8Array {
  switch (event.type) {
    case "text-delta":
      return sse.encode("text-delta", { delta: event.delta });
    case "tool-input-start":
      return sse.encode("tool-input-start", {
        toolCallId: event.toolCallId,
        toolName: event.toolName,
      });
    case "tool-input-available":
      return sse.encode("tool-input-available", {
        toolCallId: event.toolCallId,
        input: event.input,
      });
    case "tool-output-available":
      return sse.encode("tool-output-available", {
        toolCallId: event.toolCallId,
        output: event.output,
      });
    case "status":
      return sse.encode("status", { label: event.label });
    case "step-complete":
      return sse.encode("step-complete", {
        tokensIn: event.usage.tokensIn,
        tokensOut: event.usage.tokensOut,
      });
    case "finish":
      return sse.encode("finish", {
        tokensIn: event.usage.tokensIn,
        tokensOut: event.usage.tokensOut,
        totalSteps: event.usage.totalSteps,
        finishReason: event.finishReason,
      });
    case "error":
      return sse.encode("error", { message: event.message });
  }
}

// ─── POST Handler ────────────────────────────────────────

export async function POST(req: Request) {
  // 1. Auth — required for everything
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Parse body
  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { conversationId, messages, isGreeting } = parsed.data;

  // 3. Load user + workspace
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user?.workspaceId) {
    return new Response(JSON.stringify({ error: "No workspace" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const workspaceId = user.workspaceId;
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    include: {
      integrations: { select: { type: true, status: true } },
    },
  });

  // 4. Greeting fast-path — deterministic, no LLM
  if (isGreeting) {
    const firstName = (user.name ?? "").split(" ")[0] || undefined;
    const greetingText = buildGreeting(workspace as WorkspaceWithIntegrations, firstName);
    const sse = new SSEEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(sse.retryDirective(3000));
          controller.enqueue(
            sse.encode("stream-start", {
              streamId: generateStreamId(),
              conversationId,
              ts: Date.now(),
            }),
          );
          controller.enqueue(
            sse.encode("text-delta", { delta: greetingText }),
          );
          controller.enqueue(
            sse.encode("finish", {
              tokensIn: 0,
              tokensOut: 0,
              totalSteps: 0,
              finishReason: "stop",
            }),
          );
          controller.enqueue(sse.encode("stream-end", {}));

          // Persist conversation + greeting message to DB
          await prisma.conversation.upsert({
            where: { id: conversationId },
            create: { id: conversationId, workspaceId },
            update: { updatedAt: new Date() },
          });
          await prisma.message.create({
            data: {
              conversationId,
              role: "ASSISTANT",
              content: greetingText,
            },
          });
        } catch (err) {
          controller.enqueue(
            sse.encode("error", {
              message: err instanceof Error ? err.message : "Greeting failed",
            }),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  }

  // 5. Load context in parallel
  const [memories, styleCorrections] = await Promise.all([
    prisma.agentMemory.findMany({
      where: { workspaceId },
      select: { key: true, value: true },
    }),
    getStyleSamples(workspaceId),
  ]);

  // 6. Build system prompt
  const systemPrompt = buildSystemPrompt(
    workspace as WorkspaceWithIntegrations,
    memories,
    styleCorrections,
  );

  // 7. Build tool set
  const toolCtx = {
    workspaceId,
    userId: user.id,
    onStatus: undefined as ((label: string) => void) | undefined,
  };
  const tools = buildToolSet(workspace as WorkspaceWithIntegrations, toolCtx);

  // 8. Convert messages to ChatMessage format
  const chatMessages: ChatMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // 9. Stream response
  const sse = new SSEEncoder();
  let fullAssistantContent = "";
  const toolCalls: Array<{ toolName: string; input: unknown; output: unknown }> = [];

  const stream = new ReadableStream({
    async start(controller) {
      let keepAlive: ReturnType<typeof setInterval> | undefined;

      try {
        // Retry directive + stream-start framing
        controller.enqueue(sse.retryDirective(3000));
        controller.enqueue(
          sse.encode("stream-start", {
            streamId: generateStreamId(),
            conversationId,
            ts: Date.now(),
          }),
        );

        // Keepalive: ping every 15s to prevent proxy timeouts
        keepAlive = setInterval(() => {
          controller.enqueue(sse.ping());
        }, 15_000);

        // Wire up status callback to emit SSE events
        toolCtx.onStatus = (label: string) => {
          controller.enqueue(sse.encode("status", { label }));
        };

        const generator = mistralClient.chatStream({
          system: systemPrompt,
          messages: chatMessages,
          tools,
          workspaceId,
          userId: user.id,
          temperature: 0.7,
          onStatus: toolCtx.onStatus,
        });

        for await (const event of generator) {
          // Track assistant content for DB save
          if (event.type === "text-delta") {
            fullAssistantContent += event.delta;
          }

          // Inline component markers — injected into content so they
          // persist in DB and render on reload too
          if (event.type === "tool-output-available") {
            const out = event.output as Record<string, unknown> | null;
            if (out && typeof out === "object" && "__component" in out) {
              const marker = JSON.stringify({
                component: out.__component,
                props: out.props,
              });
              fullAssistantContent += `\n\n@@INLINE@@${marker}@@END@@\n\n`;
            }
          }

          // Emit status labels for tool calls
          if (event.type === "tool-input-start") {
            const label = getToolLabel(event.toolName);
            controller.enqueue(sse.encode("status", { label }));
          }

          // Track tool calls for DB save
          if (event.type === "tool-input-available") {
            toolCalls.push({
              toolName: "",
              input: event.input,
              output: null,
            });
          }
          if (event.type === "tool-output-available" && toolCalls.length > 0) {
            toolCalls[toolCalls.length - 1].output = event.output;
          }

          // Forward all events to client as named SSE events
          controller.enqueue(streamEventToSSE(sse, event));
        }

        // Stream-end framing
        controller.enqueue(sse.encode("stream-end", {}));
      } catch (err) {
        controller.enqueue(
          sse.encode("error", {
            message: err instanceof Error ? err.message : "Stream failed",
          }),
        );
      } finally {
        if (keepAlive) clearInterval(keepAlive);
        controller.close();

        // 10. Post-stream: save messages to DB
        try {
          const lastUserMessage = messages[messages.length - 1];

          // Auto-title: use first user message (truncated to 80 chars)
          const isFirstMessage = messages.filter((m) => m.role === "user").length === 1;
          const autoTitle =
            isFirstMessage && lastUserMessage?.role === "user"
              ? lastUserMessage.content.replace(/\n/g, " ").trim().slice(0, 80)
              : undefined;

          // Ensure conversation exists (created on first message)
          await prisma.conversation.upsert({
            where: { id: conversationId },
            create: {
              id: conversationId,
              workspaceId,
              ...(autoTitle ? { title: autoTitle } : {}),
            },
            update: { updatedAt: new Date() },
          });

          // Save user message
          if (lastUserMessage?.role === "user") {
            await prisma.message.create({
              data: {
                conversationId,
                role: "USER",
                content: lastUserMessage.content,
              },
            });
          }

          // Save assistant response
          if (fullAssistantContent) {
            await prisma.message.create({
              data: {
                conversationId,
                role: "ASSISTANT",
                content: fullAssistantContent,
              },
            });
          }
        } catch {
          // DB save failure shouldn't break the response
          console.error("Failed to save messages to DB");
        }
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
