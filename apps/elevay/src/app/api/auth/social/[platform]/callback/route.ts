import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  const { platform } = await params;

  if (session?.user) {
    try {
      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (user?.workspaceId) {
        const existing = await prisma.integration.findFirst({
          where: { workspaceId: user.workspaceId, type: platform },
        });
        if (existing) {
          await prisma.integration.update({
            where: { id: existing.id },
            data: { status: 'ACTIVE' },
          });
        } else {
          await prisma.integration.create({
            data: {
              workspaceId: user.workspaceId,
              type: platform,
              status: 'ACTIVE',
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
    { headers: { "Content-Type": "text/html", "Cross-Origin-Opener-Policy": "same-origin-allow-popups" } },
  );
}
