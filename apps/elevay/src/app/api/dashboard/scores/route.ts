import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic'

interface DashboardScores {
  seoScore: number | null;
  geoScore: number | null;
  llmScore: number | null;
  criticalIssues: number | null;
  seoScoreDelta: number | null;
  geoScoreDelta: number | null;
  llmScoreDelta: number | null;
  issuesDelta: number | null;
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

  const workspaceId = user.workspaceId;

  // Latest PIO-05 run for SEO + GEO + LLM scores
  const [latestPio, previousPio, latestTsi, previousTsi] = await Promise.all([
    prisma.elevayAgentRun.findFirst({
      where: { workspaceId, agentCode: 'PIO-05', status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select: { output: true },
    }),
    prisma.elevayAgentRun.findFirst({
      where: { workspaceId, agentCode: 'PIO-05', status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      skip: 1,
      select: { output: true },
    }),
    prisma.elevayAgentRun.findFirst({
      where: { workspaceId, agentCode: 'TSI-07', status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select: { output: true },
    }),
    prisma.elevayAgentRun.findFirst({
      where: { workspaceId, agentCode: 'TSI-07', status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      skip: 1,
      select: { output: true },
    }),
  ]);

  const pioOutput = latestPio?.output as Record<string, unknown> | null;
  const prevPioOutput = previousPio?.output as Record<string, unknown> | null;
  const tsiOutput = latestTsi?.output as Record<string, unknown> | null;
  const prevTsiOutput = previousTsi?.output as Record<string, unknown> | null;

  const dashboard = pioOutput?.dualDashboard as { seoScore?: number; geoScore?: number } | undefined;
  const prevDashboard = prevPioOutput?.dualDashboard as { seoScore?: number; geoScore?: number } | undefined;
  const llmCitability = pioOutput?.llmCitabilityScore as { total?: number } | undefined;
  const prevLlmCitability = prevPioOutput?.llmCitabilityScore as { total?: number } | undefined;
  const actionPlan = tsiOutput?.actionPlan as { immediate?: unknown[] } | undefined;
  const prevActionPlan = prevTsiOutput?.actionPlan as { immediate?: unknown[] } | undefined;

  const seoScore = dashboard?.seoScore ?? null;
  const geoScore = dashboard?.geoScore ?? null;
  const llmScore = llmCitability?.total ?? null;
  const criticalIssues = actionPlan?.immediate?.length ?? null;

  const scores: DashboardScores = {
    seoScore,
    geoScore,
    llmScore,
    criticalIssues,
    seoScoreDelta: seoScore != null && prevDashboard?.seoScore != null
      ? seoScore - prevDashboard.seoScore : null,
    geoScoreDelta: geoScore != null && prevDashboard?.geoScore != null
      ? geoScore - prevDashboard.geoScore : null,
    llmScoreDelta: llmScore != null && prevLlmCitability?.total != null
      ? llmScore - prevLlmCitability.total : null,
    issuesDelta: criticalIssues != null && prevActionPlan?.immediate?.length != null
      ? criticalIssues - prevActionPlan.immediate.length : null,
  };

  return Response.json(scores);
}
