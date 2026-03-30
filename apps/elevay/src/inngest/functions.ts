import { Prisma } from '@leadsens/db';
import { prisma } from '@/lib/prisma';
import { inngest } from './client';
import type { AgentId, ScheduleFrequency } from './events';

// ─── Agent code mapping ──────────────────────────────────

const AGENT_CODE_MAP: Record<AgentId, string> = {
  pio05: 'PIO-05',
  opt06: 'OPT-06',
  tsi07: 'TSI-07',
  kga08: 'KGA-08',
  mdg11: 'MDG-11',
  alt12: 'ALT-12',
};

// ─── 1. Generic schedule function ────────────────────────
// Self-perpetuating: sleeps until nextRunAt, fires the run event,
// then reschedules itself for the next cycle.

export const agentScheduleNextRun = inngest.createFunction(
  { id: 'agent-schedule-next-run', retries: 1 },
  { event: 'elevay/agent.report.schedule' },
  async ({ event, step }) => {
    const { clientId, workspaceId, agentId, frequency, nextRunAt } = event.data;

    // Validate nextRunAt
    const targetTime = new Date(nextRunAt).getTime();
    if (isNaN(targetTime)) {
      console.warn('[inngest] Invalid nextRunAt date:', nextRunAt);
      return { skipped: true, reason: 'invalid_date' };
    }
    if (targetTime < Date.now() - 60_000) {
      console.warn('[inngest] Rejected past-date event:', nextRunAt);
      return { skipped: true, reason: 'past_date' };
    }

    // Sleep until the scheduled time
    const sleepUntil = new Date(nextRunAt);
    const now = new Date();
    const sleepMs = sleepUntil.getTime() - now.getTime();

    if (sleepMs > 0) {
      await step.sleep('wait-until-next-run', sleepMs);
    }

    // Check if schedule is still active
    const profile = await step.run('check-schedule-status', async () => {
      const bp = await prisma.elevayBrandProfile.findFirst({
        where: { workspaceId },
        select: { id: true, report_recurrence: true },
      });
      return bp;
    });

    if (!profile || profile.report_recurrence === 'on_demand' || !profile.report_recurrence) {
      return { skipped: true, reason: 'Schedule cancelled or set to on-demand' };
    }

    // Fire the actual report generation
    await step.sendEvent('trigger-report', {
      name: 'elevay/agent.report.run',
      data: { clientId, workspaceId, agentId, scheduledFor: new Date().toISOString() },
    });

    // Reschedule for the next cycle
    const nextDate = computeNextDate(frequency);
    try {
      await step.sendEvent('reschedule', {
        name: 'elevay/agent.report.schedule',
        data: {
          clientId,
          workspaceId,
          agentId,
          frequency,
          nextRunAt: nextDate.toISOString(),
        },
      });
    } catch (err) {
      console.error('[inngest] Reschedule event failed — schedule may be broken:', err);
    }

    return { scheduled: true, agentId, nextRunAt: nextDate.toISOString() };
  },
);

// ─── 2. Generic run function ─────────────────────────────
// Routes to the correct agent activate() based on agentId.

export const agentRunScheduled = inngest.createFunction(
  {
    id: 'agent-run-scheduled',
    retries: 3,
    idempotency: 'event.data.agentId + "-" + event.data.workspaceId + "-" + event.data.scheduledFor',
    onFailure: async ({ event: failureEvent, error }) => {
      const { agentId, workspaceId } = failureEvent.data.event.data;
      console.error(`[inngest] Agent ${agentId} exhausted all retries:`, error.message);
      try {
        await prisma.elevayAgentRun.create({
          data: {
            workspaceId,
            agentCode: AGENT_CODE_MAP[agentId as AgentId] ?? agentId,
            status: 'FAILED',
            output: { error: error.message ?? 'All retries exhausted' } as unknown as Prisma.InputJsonValue,
            degradedSources: [],
            durationMs: 0,
          },
        });
      } catch (dbErr) {
        console.error('[inngest] Failed to record failure:', dbErr);
      }
    },
  },
  { event: 'elevay/agent.report.run' },
  async ({ event, step }) => {
    const { clientId, workspaceId, agentId } = event.data;

    // Load brand profile
    const profile = await step.run('load-profile', async () => {
      const bp = await prisma.elevayBrandProfile.findFirst({
        where: { workspaceId },
        select: {
          id: true,
          brand_name: true,
          brand_url: true,
          report_recurrence: true,
          primary_keyword: true,
          secondary_keyword: true,
        },
      });
      return bp;
    });

    if (!profile) {
      return { error: 'Brand profile not found', clientId, agentId };
    }

    if (profile.report_recurrence === 'on_demand' || !profile.report_recurrence) {
      return { skipped: true, reason: 'Report recurrence set to on-demand', agentId };
    }

    // Build shared context
    const context = {
      clientProfile: {
        id: clientId,
        siteUrl: profile.brand_url,
        cmsType: 'other' as const,
        automationLevel: 'audit' as const,
        geoLevel: 'national' as const,
        targetGeos: ['FR'],
        priorityPages: [],
        alertChannels: [] as ('slack' | 'email' | 'report')[],
        connectedTools: { gsc: false, ga: false, ahrefs: false, semrush: false },
      },
      sessionId: `inngest-${agentId}-${Date.now()}`,
      triggeredBy: 'inngest-schedule',
    };

    const keywords = [profile.primary_keyword, profile.secondary_keyword].filter(Boolean);

    // Route to the correct agent
    const result = await step.run(`run-${agentId}`, async () => {
      const startTime = Date.now();
      const session = await runAgent(agentId, context, profile.brand_url, keywords);
      const durationMs = Date.now() - startTime;
      return { output: session.output, durationMs };
    });

    // Store the run in ElevayAgentRun
    await step.run('store-result', async () => {
      await prisma.elevayAgentRun.create({
        data: {
          workspaceId,
          agentCode: AGENT_CODE_MAP[agentId],
          status: 'COMPLETED',
          output: result.output as unknown as Prisma.InputJsonValue,
          degradedSources: [],
          durationMs: result.durationMs,
          brandProfileId: profile.id,
        },
      });
    });

    return { success: true, agentId, durationMs: result.durationMs };
  },
);

// ─── Agent router ────────────────────────────────────────

interface AgentRunContext {
  clientProfile: {
    id: string;
    siteUrl: string;
    cmsType: 'other';
    automationLevel: 'audit';
    geoLevel: 'national';
    targetGeos: string[];
    priorityPages: string[];
    alertChannels: ('slack' | 'email' | 'report')[];
    connectedTools: { gsc: boolean; ga: boolean; ahrefs: boolean; semrush: boolean };
  };
  sessionId: string;
  triggeredBy: string;
}

async function runAgent(
  agentId: AgentId,
  context: AgentRunContext,
  siteUrl: string,
  keywords: string[],
): Promise<{ output: unknown }> {
  switch (agentId) {
    case 'pio05': {
      const { activate } = await import('../../agents/seo-geo/pio05/index');
      return activate(context, {
        siteUrl,
        targetKeywords: keywords,
        geoTargets: ['FR'],
        competitorUrls: [],
        reportFrequency: 'on-demand', // scheduled run doesn't re-schedule from inside
        gscConnected: false,
        gaConnected: false,
      });
    }
    case 'tsi07': {
      const { activate } = await import('../../agents/seo-geo/tsi07/index');
      return activate(context, {
        siteUrl,
        cmsType: 'other',
        automationLevel: 'audit',
        priorityPages: [],
        alertChannel: 'report',
        gscConnected: false,
        gaConnected: false,
      });
    }
    case 'opt06': {
      const { activate } = await import('../../agents/seo-geo/opt06/index');
      return activate(context, {
        siteUrl,
        targetPages: [],
        targetKeywords: {},
        competitors: [],
        automationLevel: 'audit',
        geoTargets: ['FR'],
        gscConnected: false,
        gaConnected: false,
      });
    }
    case 'kga08': {
      const { activate } = await import('../../agents/seo-geo/kga08/index');
      return activate(context, {
        siteUrl,
        targetPages: [],
        businessObjective: 'traffic',
        geoLevel: 'national',
        targetGeos: ['FR'],
        competitors: [],
        monthlyContentCapacity: 4,
        seoMaturity: 'beginner',
        prioritization: 'volume',
        gscConnected: false,
        multiCountry: false,
      }, []);
    }
    case 'mdg11': {
      const { activate } = await import('../../agents/seo-geo/mdg11/index');
      return activate(context, {
        siteUrl,
        scope: 'all',
        cmsType: 'other',
        brandTone: 'informative',
        variationsCount: 3,
        language: 'fr',
        inject: false,
      }, []);
    }
    case 'alt12': {
      const { activate } = await import('../../agents/seo-geo/alt12/index');
      return activate(context, {
        siteUrl,
        scope: 'all',
        cmsType: 'other',
        brandTone: 'descriptive',
        language: 'fr',
        variationsCount: 2,
        inject: false,
      }, []);
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────

function computeNextDate(frequency: ScheduleFrequency): Date {
  const next = new Date();
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next;
}
