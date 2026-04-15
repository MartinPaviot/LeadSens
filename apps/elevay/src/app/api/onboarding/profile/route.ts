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

  const profile = await prisma.elevayBrandProfile.findUnique({
    where: { workspaceId: user.workspaceId },
    select: {
      brand_url: true,
      language: true,
      sector: true,
      social_connections: true,
    },
  });

  return Response.json({ profile });
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

  await prisma.elevayBrandProfile.deleteMany({
    where: { workspaceId: user.workspaceId },
  });

  return Response.json({ deleted: true });
}
