import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SSEEncoder, SSE_HEADERS, generateStreamId } from "@/lib/sse";
import { Mistral } from "@mistralai/mistralai";
import { z } from "zod/v4";

export const maxDuration = 120;

function buildSystemPrompt(profileLanguage: string | null): string {
  const langRule = profileLanguage
    ? `Always respond in the brand's configured language: "${profileLanguage}". If it is 'fr' or 'French', write in French. If it is 'en' or 'English', write in English. Override this only if the user explicitly writes in a different language.`
    : `Always respond in English unless the user's last message is clearly in another language.`;

  return `You are Elevay, an AI marketing assistant.

PERSONALITY: Warm, creative, strategic. You help with content strategy, copywriting, campaign planning, social media, email marketing, and brand positioning.

LANGUAGE: ${langRule}

COMMUNICATION:
- Be concise but thorough
- Use clean markdown formatting
- Provide actionable suggestions
- Ask clarifying questions when needed
- Never fabricate data or statistics`;
}

const requestSchema = z.object({
  conversationId: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
  isGreeting: z.boolean(),
});

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY ?? "" });

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user?.workspaceId) {
    return new Response("No workspace", { status: 400 });
  }

  const brandProfile = await prisma.elevayBrandProfile.findUnique({
    where: { workspaceId: user.workspaceId },
    select: { language: true },
  }).catch(() => null);

  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("Invalid request", { status: 400 });
  }

  const { conversationId, messages, isGreeting } = parsed.data;

  // ─── Greeting (non-streaming JSON response) ───────────
  if (isGreeting) {
    const hour = new Date().getHours();
    const timeGreeting =
      hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const name = user.name?.split(" ")[0] ?? "";

    const greeting = `${timeGreeting}${name ? `, ${name}` : ""}! I'm Elevay, your AI marketing assistant. I can help you with content strategy, copywriting, campaign planning, and more.\n\nWhat would you like to work on today?`;

    // Ensure conversation exists
    await prisma.conversation.upsert({
      where: { id: conversationId },
      create: {
        id: conversationId,
        workspaceId: user.workspaceId,
      },
      update: {},
    });

    return Response.json({ greeting });
  }

  // ─── Chat (streaming SSE response) ───────────────────
  const encoder = new SSEEncoder();
  const streamId = generateStreamId();

  // Ensure conversation exists and save user message
  const lastUserMsg = messages[messages.length - 1];
  await prisma.conversation.upsert({
    where: { id: conversationId },
    create: {
      id: conversationId,
      workspaceId: user.workspaceId,
      title: lastUserMsg?.content?.slice(0, 100) ?? null,
    },
    update: {
      updatedAt: new Date(),
      title:
        messages.filter((m) => m.role === "user").length === 1
          ? lastUserMsg?.content?.slice(0, 100)
          : undefined,
    },
  });

  if (lastUserMsg) {
    await prisma.message.create({
      data: {
        conversationId,
        role: "USER",
        content: lastUserMsg.content,
      },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.retryDirective(3000));
        controller.enqueue(
          encoder.encode("stream-start", {
            streamId,
            conversationId,
            ts: Date.now(),
          }),
        );

        const llmMessages = [
          { role: "system" as const, content: buildSystemPrompt(brandProfile?.language ?? null) },
          ...messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ];

        const response = await mistral.chat.stream({
          model: "mistral-large-latest",
          messages: llmMessages,
          maxTokens: 4096,
          temperature: 0.7,
        });

        let fullContent = "";

        for await (const chunk of response) {
          const rawDelta = chunk.data?.choices?.[0]?.delta?.content;
          const delta = typeof rawDelta === "string" ? rawDelta : "";
          if (delta) {
            fullContent += delta;
            controller.enqueue(
              encoder.encode("text-delta", { delta }),
            );
          }
        }

        // Save assistant message
        await prisma.message.create({
          data: {
            conversationId,
            role: "ASSISTANT",
            content: fullContent,
          },
        });

        controller.enqueue(
          encoder.encode("finish", {
            tokensIn: 0,
            tokensOut: 0,
            totalSteps: 0,
            finishReason: "stop",
          }),
        );
        controller.enqueue(encoder.encode("stream-end", {}));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(
          encoder.encode("error", { message }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
