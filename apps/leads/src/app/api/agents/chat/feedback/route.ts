import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";
import { headers } from "next/headers";

const feedbackSchema = z.object({
  messageId: z.string().min(1),
  conversationId: z.string().min(1),
  type: z.enum(["THUMBS_UP", "THUMBS_DOWN"]),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const { messageId, conversationId, type } = parsed.data;

  // Get workspace via user
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { workspaceId: true },
  });

  if (!user?.workspaceId) {
    return Response.json({ error: "No workspace" }, { status: 403 });
  }

  // Verify conversation belongs to workspace
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      workspaceId: user.workspaceId,
    },
    select: { id: true },
  });

  if (!conversation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.agentFeedback.create({
    data: {
      workspaceId: user.workspaceId,
      type,
      originalOutput: messageId,
      metadata: { conversationId, messageId },
    },
  });

  return Response.json({ ok: true });
}
