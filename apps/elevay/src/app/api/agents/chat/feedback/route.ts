import { auth } from "@/lib/auth";
import { z } from "zod/v4";

const feedbackSchema = z.object({
  messageId: z.string(),
  conversationId: z.string(),
  type: z.enum(["THUMBS_UP", "THUMBS_DOWN"]),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("Invalid request", { status: 400 });
  }

  // For now, just acknowledge — can be stored later
  return Response.json({ ok: true });
}
