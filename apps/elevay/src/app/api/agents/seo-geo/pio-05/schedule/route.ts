import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@leadsens/db';
import { inngest } from '@/inngest/client';
import { pio05SchedulePostSchema, pio05SchedulePatchSchema } from '@/lib/schemas/seo-routes';
import { checkRateLimit } from '@/lib/rate-limit';
import { computeNextDate } from '@/lib/schedule-utils';

export const dynamic = 'force-dynamic'

async function getWorkspaceSchedule(workspaceId: string) {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, settings: true },
  });
  if (!ws) return null;
  const settings = (ws.settings as Record<string, unknown> | null) ?? {};
  return { id: ws.id, workspaceId, reportRecurrence: (settings.reportRecurrence as string) ?? 'on_demand', settings };
}

async function setReportRecurrence(workspaceId: string, recurrence: string) {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { settings: true },
  });
  const existing = (ws?.settings as Record<string, unknown> | null) ?? {};
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      settings: { ...existing, reportRecurrence: recurrence } as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const rl = await checkRateLimit(session.user.id, 'pio05-schedule');
  if (!rl.allowed) {
    return Response.json(
      { error: 'Rate limit exceeded', retryAfter: rl.retryAfter },
      { status: 429 },
    );
  }

  const parsed = pio05SchedulePostSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request body', details: parsed.error.format() }, { status: 400 });
  }
  const { frequency } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { workspaceId: true },
  });
  if (!user?.workspaceId) {
    return Response.json({ error: 'No workspace found' }, { status: 404 });
  }

  const schedule = await getWorkspaceSchedule(user.workspaceId);
  if (!schedule) {
    return Response.json({ error: 'No workspace found' }, { status: 404 });
  }

  if (frequency === 'on_demand') {
    await setReportRecurrence(user.workspaceId, 'on_demand');
    return Response.json({ status: 'cancelled', message: 'Report scheduling cancelled' });
  }

  const nextRunAt = computeNextDate(new Date(), frequency);

  if (isNaN(nextRunAt.getTime())) {
    return Response.json({ error: 'Failed to compute next run date' }, { status: 500 });
  }

  try {
    await inngest.send({
      name: 'elevay/agent.report.schedule',
      data: {
        clientId: session.user.id,
        workspaceId: user.workspaceId,
        agentId: 'pio05',
        frequency,
        nextRunAt: nextRunAt.toISOString(),
      },
    });
  } catch {
    return Response.json(
      { error: 'Failed to dispatch scheduling event' },
      { status: 500 },
    );
  }

  await setReportRecurrence(user.workspaceId, frequency);

  return Response.json({ status: 'scheduled', frequency, nextRunAt: nextRunAt.toISOString() });
}

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const rlPatch = await checkRateLimit(session.user.id, 'pio05-schedule');
  if (!rlPatch.allowed) {
    return Response.json(
      { error: 'Rate limit exceeded', retryAfter: rlPatch.retryAfter },
      { status: 429 },
    );
  }

  const parsedPatch = pio05SchedulePatchSchema.safeParse(await req.json());
  if (!parsedPatch.success) {
    return Response.json({ error: 'Invalid request body', details: parsedPatch.error.format() }, { status: 400 });
  }
  const { action } = parsedPatch.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { workspaceId: true },
  });
  if (!user?.workspaceId) {
    return Response.json({ error: 'No workspace found' }, { status: 404 });
  }

  const schedule = await getWorkspaceSchedule(user.workspaceId);
  if (!schedule) {
    return Response.json({ error: 'No workspace found' }, { status: 404 });
  }

  if (action === 'pause') {
    await setReportRecurrence(user.workspaceId, 'on_demand');
    return Response.json({ status: 'paused' });
  }

  if (action === 'resume') {
    const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;
    const rawFreq = schedule.reportRecurrence ?? 'monthly';
    if (!(VALID_FREQUENCIES as readonly string[]).includes(rawFreq)) {
      return Response.json({ error: 'Invalid stored frequency — please reschedule' }, { status: 400 });
    }
    const frequency = rawFreq as 'daily' | 'weekly' | 'monthly';
    const nextRunAt = computeNextDate(new Date(), frequency);

    if (isNaN(nextRunAt.getTime())) {
      return Response.json({ error: 'Failed to compute next run date' }, { status: 500 });
    }

    try {
      await inngest.send({
        name: 'elevay/agent.report.schedule',
        data: {
          clientId: session.user.id,
          workspaceId: user.workspaceId,
          agentId: 'pio05',
          frequency,
          nextRunAt: nextRunAt.toISOString(),
        },
      });
    } catch {
      return Response.json(
        { error: 'Failed to dispatch scheduling event' },
        { status: 500 },
      );
    }

    await setReportRecurrence(user.workspaceId, frequency);

    return Response.json({ status: 'resumed', nextRunAt: nextRunAt.toISOString() });
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 });
}
