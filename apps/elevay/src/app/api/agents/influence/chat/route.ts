import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadWorkspaceContext } from "@/lib/agent-context";
import { toInfluenceBriefDefaults } from "@/lib/agent-adapters";
import { z } from "zod";
import { getSystemPrompt } from "@agents/influence/prompts/briefCollection";

export const dynamic = 'force-dynamic'

const messageSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
  brief: z.record(z.string(), z.unknown()).optional(),
  lang: z.enum(["fr", "en"]).optional(),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ response: null, error: "API key not configured", fallback: true });
  }

  const parsed = messageSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { messages, lang } = parsed.data;

  // Pre-fill brief defaults from Settings so the LLM doesn't re-ask known fields
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { workspaceId: true },
  });
  const defaults = user?.workspaceId
    ? toInfluenceBriefDefaults(await loadWorkspaceContext(user.workspaceId)).data
    : {};

  const effectiveLang = lang ?? (defaults.language === 'fr' ? 'fr' : 'en');
  const systemPrompt = getSystemPrompt(effectiveLang, defaults);

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: 0.7,
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    let briefUpdate: Record<string, unknown> | undefined;
    let briefComplete = false;
    let cleanText = text;

    const completeMatch = text.match(/<brief_complete>([\s\S]*?)<\/brief_complete>/);
    if (completeMatch) {
      try {
        briefUpdate = JSON.parse(completeMatch[1]) as Record<string, unknown>;
        briefComplete = true;
      } catch { /* ignore */ }
      cleanText = text.replace(/<brief_complete>[\s\S]*?<\/brief_complete>/, '').trim();
    } else {
      const updateMatch = text.match(/<brief_update>([\s\S]*?)<\/brief_update>/);
      if (updateMatch) {
        try {
          briefUpdate = JSON.parse(updateMatch[1]) as Record<string, unknown>;
        } catch { /* ignore */ }
        cleanText = text.replace(/<brief_update>[\s\S]*?<\/brief_update>/, '').trim();
      }
    }

    return Response.json({
      response: cleanText,
      briefUpdate: briefUpdate ?? null,
      briefComplete,
    });
  } catch (err) {
    return Response.json({ response: null, error: "Failed to get response" }, { status: 500 });
  }
}
