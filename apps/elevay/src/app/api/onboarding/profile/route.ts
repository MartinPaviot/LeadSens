import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { workspaceId: true },
  });
  if (!user?.workspaceId) {
    return Response.json({ profile: null });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: user.workspaceId },
    select: {
      companyUrl: true,
      industry: true,
      settings: true,
    },
  });

  const settings = (workspace?.settings as Record<string, unknown> | null) ?? {};

  return Response.json({
    profile: {
      brand_url: workspace?.companyUrl ?? null,
      language: settings.language ?? null,
      sector: workspace?.industry ?? null,
      social_connections: settings.socialConnections ?? null,
    },
  });
}

export async function DELETE(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Not allowed', { status: 403 });
  }

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { workspaceId: true },
  });
  if (!user?.workspaceId) {
    return Response.json({ deleted: false });
  }

  await prisma.workspace.update({
    where: { id: user.workspaceId },
    data: { settings: {}, onboardingCompletedAt: null },
  });

  return Response.json({ deleted: true });
}
