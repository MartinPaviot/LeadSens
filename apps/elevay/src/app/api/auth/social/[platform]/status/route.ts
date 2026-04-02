import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_PLATFORMS = ["linkedin", "linkedin-community", "instagram", "tiktok", "facebook", "x", "googledrive", "googledocs", "gsc", "ga", "slack", "ahrefs", "semrush"] as const;
type Platform = (typeof VALID_PLATFORMS)[number];

function isPlatform(v: string): v is Platform {
  return (VALID_PLATFORMS as readonly string[]).includes(v);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { platform } = await params;
    if (!isPlatform(platform)) {
      return new Response("Unknown platform", { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.workspaceId) {
      return Response.json({ connected: false });
    }

    const profile = await prisma.elevayBrandProfile.findUnique({
      where: { workspaceId: user.workspaceId },
      select: { social_connections: true },
    });

    const connections = profile?.social_connections as Record<string, boolean> | null;
    return Response.json({ connected: connections?.[platform] === true });
  } catch (err) {
    console.error("[social-status] error:", err);
    return Response.json({ connected: false });
  }
}
