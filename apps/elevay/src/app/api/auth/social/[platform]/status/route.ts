import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic'

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

    const integration = await prisma.integration.findFirst({
      where: { workspaceId: user.workspaceId, type: platform, status: 'ACTIVE' },
    });

    return Response.json({ connected: !!integration });
  } catch {
    return Response.json({ connected: false });
  }
}
