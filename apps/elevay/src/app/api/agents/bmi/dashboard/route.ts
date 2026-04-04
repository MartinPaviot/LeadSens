import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { workspaceId: true },
  });
  if (!user?.workspaceId) {
    return Response.json({ bpi: null, mts: null, cia: null, timestamps: { bpi: null, mts: null, cia: null } });
  }

  // Fetch latest completed run for each agent
  const [bpiRun, mtsRun, ciaRun] = await Promise.all([
    prisma.elevayAgentRun.findFirst({
      where: { workspaceId: user.workspaceId, agentCode: 'bpi01', status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select: { output: true, createdAt: true },
    }),
    prisma.elevayAgentRun.findFirst({
      where: { workspaceId: user.workspaceId, agentCode: 'mts02', status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select: { output: true, createdAt: true },
    }),
    prisma.elevayAgentRun.findFirst({
      where: { workspaceId: user.workspaceId, agentCode: 'cia03', status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select: { output: true, createdAt: true },
    }),
  ]);

  return Response.json({
    bpi: bpiRun?.output ?? null,
    mts: mtsRun?.output ?? null,
    cia: ciaRun?.output ?? null,
    timestamps: {
      bpi: bpiRun?.createdAt.toISOString() ?? null,
      mts: mtsRun?.createdAt.toISOString() ?? null,
      cia: ciaRun?.createdAt.toISOString() ?? null,
    },
  });
}
