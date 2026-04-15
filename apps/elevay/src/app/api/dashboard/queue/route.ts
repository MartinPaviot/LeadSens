import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic'

const AGENT_NAMES: Record<string, string> = {
  'BSW-10': 'Blog writer',
  'MDG-11': 'Meta description generator',
  'TSI-07': 'Technical audit',
  'WPW-09': 'Page writer',
  'OPT-06': 'SEO optimizer',
  'ALT-12': 'ALT text generator',
  'KGA-08': 'Keyword planner',
};

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { workspaceId: true },
  });
  if (!user?.workspaceId) {
    return Response.json({ error: 'No workspace' }, { status: 404 });
  }

  const runs = await prisma.elevayAgentRun.findMany({
    where: { workspaceId: user.workspaceId, status: 'PENDING_VALIDATION' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, agentCode: true, output: true, createdAt: true },
  });

  const items = runs.map((run) => {
    const output = run.output as Record<string, unknown> | null;
    const structure = output?.articleStructure as { titleOptions?: string[] } | undefined;
    return {
      id: run.id,
      agentCode: run.agentCode,
      agentName: AGENT_NAMES[run.agentCode] ?? run.agentCode,
      topic: (output?.topic as string)
        ?? (output?.h1 as string)
        ?? structure?.titleOptions?.[0]
        ?? 'Untitled content',
      draftUrl: (output?.wpDraftUrl as string) ?? null,
      createdAt: run.createdAt.toISOString(),
    };
  });

  return Response.json(items);
}
