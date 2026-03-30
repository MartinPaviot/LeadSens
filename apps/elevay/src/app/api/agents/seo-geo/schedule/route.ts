import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { inngest } from '@/inngest/client';
import type { ScheduleFrequency } from '@/inngest/events';
import { schedulePostSchema, schedulePatchSchema } from '@/lib/schemas/seo-routes';
import { checkRateLimit } from '@/lib/rate-limit';

// POST — Create or update schedule for any agent
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  // Rate limit
  const rl = await checkRateLimit(session.user.id, 'schedule');
  if (!rl.allowed) {
    return Response.json(
      { error: 'Rate limit exceeded', retryAfter: rl.retryAfter },
      { status: 429 },
    );
  }

  const parsed = schedulePostSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request body', details: parsed.error.format() }, { status: 400 });
  }
  const { agentId, frequency: rawFrequency } = parsed.data;
  const isCancel = rawFrequency === 'on_demand' || rawFrequency === 'on-demand';

  // Find user's workspace + brand profile
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { workspaceId: true },
  });
  if (!user?.workspaceId) {
    return Response.json({ error: 'No workspace found' }, { status: 404 });
  }

  const profile = await prisma.elevayBrandProfile.findUnique({
    where: { workspaceId: user.workspaceId },
    select: { id: true, workspaceId: true },
  });
  if (!profile) {
    return Response.json({ error: 'No brand profile found' }, { status: 404 });
  }

  // Update recurrence
  await prisma.elevayBrandProfile.update({
    where: { id: profile.id },
    data: { report_recurrence: isCancel ? 'on_demand' : rawFrequency },
  });

  if (isCancel) {
    return Response.json({ status: 'cancelled', agentId });
  }

  const frequency = rawFrequency as ScheduleFrequency;

  // Compute next run date
  const nextRunAt = new Date();
  switch (frequency) {
    case 'daily': nextRunAt.setDate(nextRunAt.getDate() + 1); break;
    case 'weekly': nextRunAt.setDate(nextRunAt.getDate() + 7); break;
    case 'monthly': nextRunAt.setMonth(nextRunAt.getMonth() + 1); break;
  }

  if (isNaN(nextRunAt.getTime())) {
    return Response.json({ error: 'Failed to compute next run date' }, { status: 500 });
  }

  // Send Inngest scheduling event
  try {
    await inngest.send({
      name: 'elevay/agent.report.schedule',
      data: {
        clientId: session.user.id,
        workspaceId: profile.workspaceId,
        agentId,
        frequency,
        nextRunAt: nextRunAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('[schedule] Inngest dispatch failed:', err);
    return Response.json({
      status: 'scheduled',
      warning: 'Schedule saved but event dispatch failed',
      agentId,
      frequency,
      nextRunAt: nextRunAt.toISOString(),
    });
  }

  return Response.json({
    status: 'scheduled',
    agentId,
    frequency,
    nextRunAt: nextRunAt.toISOString(),
  });
}

// PATCH — Pause / resume / cancel scheduling for any agent
export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  // Rate limit
  const rlPatch = await checkRateLimit(session.user.id, 'schedule');
  if (!rlPatch.allowed) {
    return Response.json(
      { error: 'Rate limit exceeded', retryAfter: rlPatch.retryAfter },
      { status: 429 },
    );
  }

  const parsedPatch = schedulePatchSchema.safeParse(await req.json());
  if (!parsedPatch.success) {
    return Response.json({ error: 'Invalid request body', details: parsedPatch.error.format() }, { status: 400 });
  }
  const { agentId, action, frequency: patchFrequency } = parsedPatch.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { workspaceId: true },
  });
  if (!user?.workspaceId) {
    return Response.json({ error: 'No workspace found' }, { status: 404 });
  }

  const profile = await prisma.elevayBrandProfile.findUnique({
    where: { workspaceId: user.workspaceId },
    select: { id: true, workspaceId: true, report_recurrence: true },
  });
  if (!profile) {
    return Response.json({ error: 'No brand profile found' }, { status: 404 });
  }

  if (action === 'pause' || action === 'cancel') {
    await prisma.elevayBrandProfile.update({
      where: { id: profile.id },
      data: { report_recurrence: 'on_demand' },
    });
    return Response.json({ status: action === 'pause' ? 'paused' : 'cancelled', agentId });
  }

  if (action === 'resume') {
    const frequency = (patchFrequency ?? profile.report_recurrence ?? 'monthly') as ScheduleFrequency;

    await prisma.elevayBrandProfile.update({
      where: { id: profile.id },
      data: { report_recurrence: frequency },
    });

    const nextRunAt = new Date();
    switch (frequency) {
      case 'daily': nextRunAt.setDate(nextRunAt.getDate() + 1); break;
      case 'weekly': nextRunAt.setDate(nextRunAt.getDate() + 7); break;
      case 'monthly': nextRunAt.setMonth(nextRunAt.getMonth() + 1); break;
    }

    try {
      await inngest.send({
        name: 'elevay/agent.report.schedule',
        data: {
          clientId: session.user.id,
          workspaceId: profile.workspaceId,
          agentId,
          frequency,
          nextRunAt: nextRunAt.toISOString(),
        },
      });
    } catch (err) {
      console.error('[schedule] Inngest dispatch failed:', err);
      return Response.json({
        status: 'resumed',
        warning: 'Schedule saved but event dispatch failed',
        agentId,
        frequency,
        nextRunAt: nextRunAt.toISOString(),
      });
    }

    return Response.json({ status: 'resumed', agentId, frequency, nextRunAt: nextRunAt.toISOString() });
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 });
}
