import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return Response.json({ connected: false, email: null });
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.workspaceId) {
    return Response.json({ connected: false, email: null });
  }
  const integration = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId: user.workspaceId, type: "google-docs" } },
    select: { status: true, accountEmail: true },
  });
  const connected = integration?.status === "ACTIVE";
  return Response.json({ connected, email: connected ? (integration?.accountEmail ?? null) : null });
}
