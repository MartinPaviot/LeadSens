import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const AGENT_NAMES: Record<string, string> = {
  'BSW-10': 'Blog writer',
  'MDG-11': 'Meta description generator',
  'TSI-07': 'Technical audit',
  'WPW-09': 'Page writer',
  'OPT-06': 'SEO optimizer',
  'ALT-12': 'ALT text generator',
  'KGA-08': 'Keyword planner',
  'PIO-05': 'SEO/GEO report',
  'BPI-01': 'Brand audit',
  'CIA-03': 'Competitive intelligence',
  'MTS-02': 'Market trends',
};

function buildSummary(
  agentCode: string,
  status: string,
  output: Record<string, unknown> | null,
): string {
  const name = AGENT_NAMES[agentCode] ?? agentCode;
  const topic = (output?.topic as string) ?? (output?.h1 as string) ?? '';

  switch (status) {
    case 'COMPLETED': {
      const issueCount = (output?.actionPlan as { immediate?: unknown[] })?.immediate?.length;
      return issueCount != null
        ? `${name} completed — ${issueCount} issues found`
        : `${name} completed`;
    }
    case 'PENDING_VALIDATION':
      return topic
        ? `${name} — "${topic}" ready for review`
        : `${name} ready for review`;
    case 'PUBLISHED':
      return topic
        ? `Article published — ${topic}`
        : `${name} published`;
    case 'REJECTED':
      return `${name} — draft rejected`;
    case 'FAILED':
      return `${name} failed`;
    default:
      return `${name} — ${status.toLowerCase()}`;
  }
}

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
    where: { workspaceId: user.workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, agentCode: true, status: true, output: true, createdAt: true },
  });

  const items = runs.map((run) => ({
    id: run.id,
    agentCode: run.agentCode,
    status: run.status,
    summary: buildSummary(run.agentCode, run.status, run.output as Record<string, unknown> | null),
    createdAt: run.createdAt.toISOString(),
  }));

  return Response.json(items);
}
