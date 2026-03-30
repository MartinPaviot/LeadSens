import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { inngest } from '@/inngest/client';
import { pio05SchedulePostSchema, pio05SchedulePatchSchema } from '@/lib/schemas/seo-routes';
import { checkRateLimit } from '@/lib/rate-limit';
import { computeNextDate } from '@/lib/schedule-utils';

// POST — Schedule PIO-05 reports (backward-compatible alias)
// Delegates to the generic schedule event with agentId: 'pio05'
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  // Rate limit
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

  const profile = await prisma.elevayBrandProfile.findUnique({
    where: { workspaceId: user.workspaceId },
    select: { id: true, workspaceId: true },
  });
  if (!profile) {
    return Response.json({ error: 'No brand profile found' }, { status: 404 });
  }

  if (frequency === 'on_demand') {
    await prisma.elevayBrandProfile.update({
      where: { id: profile.id },
      data: { report_recurrence: 'on_demand' },
    });
    return Response.json({ status: 'cancelled', message: 'Report scheduling cancelled' });
  }

  const nextRunAt = computeNextDate(new Date(), frequency);

  if (isNaN(nextRunAt.getTime())) {
    return Response.json({ error: 'Failed to compute next run date' }, { status: 500 });
  }

  // Send Inngest event FIRST — only update DB on success
  try {
    await inngest.send({
      name: 'elevay/agent.report.schedule',
      data: {
        clientId: session.user.id,
        workspaceId: profile.workspaceId,
        agentId: 'pio05',
        frequency,
        nextRunAt: nextRunAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('[pio05-schedule] Inngest dispatch failed:', err);
    return Response.json(
      { error: 'Failed to dispatch scheduling event' },
      { status: 500 },
    );
  }

  // Inngest event sent — now persist recurrence
  await prisma.elevayBrandProfile.update({
    where: { id: profile.id },
    data: { report_recurrence: frequency },
  });

  return Response.json({ status: 'scheduled', frequency, nextRunAt: nextRunAt.toISOString() });
}

// PATCH — Pause/resume PIO-05 scheduling
export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  // Rate limit
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

  const profile = await prisma.elevayBrandProfile.findUnique({
    where: { workspaceId: user.workspaceId },
    select: { id: true, workspaceId: true, report_recurrence: true },
  });
  if (!profile) {
    return Response.json({ error: 'No brand profile found' }, { status: 404 });
  }

  if (action === 'pause') {
    await prisma.elevayBrandProfile.update({
      where: { id: profile.id },
      data: { report_recurrence: 'on_demand' },
    });
    return Response.json({ status: 'paused' });
  }

  if (action === 'resume') {
    const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;
    const rawFreq = profile.report_recurrence ?? 'monthly';
    if (!(VALID_FREQUENCIES as readonly string[]).includes(rawFreq)) {
      return Response.json({ error: 'Invalid stored frequency — please reschedule' }, { status: 400 });
    }
    const frequency = rawFreq as 'daily' | 'weekly' | 'monthly';
    const nextRunAt = computeNextDate(new Date(), frequency);

    if (isNaN(nextRunAt.getTime())) {
      return Response.json({ error: 'Failed to compute next run date' }, { status: 500 });
    }

    // Send Inngest event FIRST
    try {
      await inngest.send({
        name: 'elevay/agent.report.schedule',
        data: {
          clientId: session.user.id,
          workspaceId: profile.workspaceId,
          agentId: 'pio05',
          frequency,
          nextRunAt: nextRunAt.toISOString(),
        },
      });
    } catch (err) {
      console.error('[pio05-schedule] Inngest dispatch failed:', err);
      return Response.json(
        { error: 'Failed to dispatch scheduling event' },
        { status: 500 },
      );
    }

    // Inngest event sent — now persist recurrence
    await prisma.elevayBrandProfile.update({
      where: { id: profile.id },
      data: { report_recurrence: frequency },
    });

    return Response.json({ status: 'resumed', nextRunAt: nextRunAt.toISOString() });
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 });
}
