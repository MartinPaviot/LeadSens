import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@leadsens/db";

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  const { platform } = await params;

  // Update social_connections in DB (best-effort — don't block the response)
  if (session?.user) {
    try {
      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (user?.workspaceId) {
        const profile = await prisma.elevayBrandProfile.findUnique({
          where: { workspaceId: user.workspaceId },
          select: { id: true, social_connections: true },
        });
        if (profile) {
          const existing = profile.social_connections as Record<string, boolean> | null;
          await prisma.elevayBrandProfile.update({
            where: { id: profile.id },
            data: {
              social_connections: {
                ...(existing ?? {}),
                [platform]: true,
              } as unknown as Prisma.InputJsonValue,
            },
          });
        }
      }
    } catch {
      // best-effort — don't fail the callback response
    }
  }

  const safeOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const platformJson = JSON.stringify(platform);
  const originJson = JSON.stringify(safeOrigin || "*");

  return new Response(
    `<!DOCTYPE html><html><body><script>
      window.opener?.postMessage({type:"SOCIAL_CONNECTED",platform:${platformJson}},${originJson});
      window.close();
    </script></body></html>`,
    { headers: { "Content-Type": "text/html", "Cross-Origin-Opener-Policy": "unsafe-none" } },
  );
}
