import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initiateLinkedInCommunityConnection } from "@/lib/composio-linkedin";

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.workspaceId) {
      return new Response("No workspace", { status: 400 });
    }

    if (!process.env.COMPOSIO_API_KEY) {
      return Response.json({ redirectUrl: null, status: "pending", message: "Connection will be available soon" });
    }

    try {
      const redirectUrl = await initiateLinkedInCommunityConnection(user.workspaceId);
      return Response.json({ redirectUrl });
    } catch {
      // Graceful fallback: mark integration as pending
      try {
        const existing = await prisma.integration.findFirst({
          where: { workspaceId: user.workspaceId, type: 'linkedin-community' },
        });
        if (existing) {
          await prisma.integration.update({
            where: { id: existing.id },
            data: { status: 'ERROR' },
          });
        } else {
          await prisma.integration.create({
            data: {
              workspaceId: user.workspaceId,
              type: 'linkedin-community',
              status: 'ERROR',
            },
          });
        }
      } catch {
        // best-effort
      }

      return Response.json({ redirectUrl: null, status: "error" });
    }
  } catch {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
