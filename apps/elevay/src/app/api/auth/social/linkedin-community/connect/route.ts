import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@leadsens/db";
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
    } catch (composioErr) {
      // Graceful fallback: store "pending" in DB
      try {
        const profile = await prisma.elevayBrandProfile.findUnique({
          where: { workspaceId: user.workspaceId },
          select: { social_connections: true },
        });
        const existing = (profile?.social_connections as Record<string, unknown>) ?? {};
        await prisma.elevayBrandProfile.updateMany({
          where: { workspaceId: user.workspaceId },
          data: {
            social_connections: { ...existing, "linkedin-community": "pending" } as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (dbErr) {
        void dbErr;
      }

      return Response.json({ redirectUrl: null, status: "error" });
    }
  } catch (err) {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
