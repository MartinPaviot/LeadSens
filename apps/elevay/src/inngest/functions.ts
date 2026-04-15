import { Prisma } from '@leadsens/db';
import { prisma } from '@/lib/prisma';
import { inngest } from './client';
import { computeNextDate } from '@/lib/schedule-utils';
import { getLatestOutputByAgent } from '@/lib/agent-history';
import type { AgentId } from './events';
import type { AgentProfile } from '@/agents/_shared/types';

// ─── Agent code mapping ──────────────────────────────────

const AGENT_CODE_MAP: Record<AgentId, string> = {
  pio05: 'PIO-05',
  opt06: 'OPT-06',
  tsi07: 'TSI-07',
  kga08: 'KGA-08',
  mdg11: 'MDG-11',
  alt12: 'ALT-12',
  wpw09: 'WPW-09',
  bsw10: 'BSW-10',
  bpi01: 'BPI-01',
  cia03: 'CIA-03',
  mts02: 'MTS-02',
  scw16: 'SCW-16',
  smc19: 'SMC-19',
  smi20: 'SMI-20',
  crm27: 'CRM-27',
  bdg32: 'BDG-32',
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
      return { skipped: true, reason: 'invalid_date' };
    }
    if (targetTime < Date.now() - 60_000) {
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
      data: { clientId, workspaceId, agentId, scheduledFor: nextRunAt },
    });

    // Reschedule for the next cycle
    const nextDate = computeNextDate(new Date(), frequency);
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
      // Mark the schedule as broken so the UI can surface it
      await step.run('mark-schedule-broken', async () => {
        await prisma.elevayBrandProfile.updateMany({
          where: { workspaceId },
          data: { report_recurrence: 'broken' },
        });
      });
      // Re-throw so Inngest retries the function (including reschedule)
      throw err;
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
        void dbErr;
      }
    },
  },
  { event: 'elevay/agent.report.run' },
  async ({ event, step }) => {
    const { clientId, workspaceId, agentId } = event.data;

    // Load brand profile with full context for agent execution
    const profile = await step.run('load-profile', async () => {
      const bp = await prisma.elevayBrandProfile.findFirst({
        where: { workspaceId },
      });
      return bp;
    });

    if (!profile) {
      return { error: 'Brand profile not found', clientId, agentId };
    }

    if (profile.report_recurrence === 'on_demand' || profile.report_recurrence === 'broken' || !profile.report_recurrence) {
      return { skipped: true, reason: 'Report recurrence set to on-demand or broken', agentId };
    }

    // Build shared context — ElevayBrandProfile doesn't store CMS/automation settings yet,
    // so we use safe defaults. These fields should be added to the schema when the
    // onboarding flow collects them.
    const context: AgentRunContext = {
      clientProfile: {
        id: clientId,
        siteUrl: profile.brand_url,
        cmsType: 'other',
        automationLevel: 'audit',
        geoLevel: 'national',
        targetGeos: profile.country ? [profile.country.slice(0, 2).toUpperCase()] : ['FR'],
        priorityPages: [],
        alertChannels: [],
        connectedTools: { gsc: false, ga: false, ahrefs: false, semrush: false },
      },
      sessionId: `inngest-${agentId}-${Date.now()}`,
      triggeredBy: 'inngest-schedule',
    };

    const keywords = [profile.primary_keyword, profile.secondary_keyword].filter(Boolean);

    // Route to the correct agent
    const result = await step.run(`run-${agentId}`, async () => {
      const startTime = Date.now();
      const bmiProfile: AgentProfile = {
        workspaceId: workspaceId,
        brand_name: profile.brand_name,
        brand_url: profile.brand_url,
        country: profile.country,
        language: profile.language ?? 'fr',
        competitors: (profile.competitors ?? []) as { name: string; url: string }[],
        primary_keyword: profile.primary_keyword,
        secondary_keyword: profile.secondary_keyword ?? '',
      };
      const session = await runAgent(agentId, context, profile.brand_url, keywords, bmiProfile, workspaceId);
      const durationMs = Date.now() - startTime;
      return { output: session.output, durationMs };
    });

    // Store the run in ElevayAgentRun
    // Content agents (wpw09/bsw10) in scheduled mode → pending_validation
    const isContentDraft = (agentId === 'wpw09' || agentId === 'bsw10');
    const runStatus = isContentDraft ? 'PENDING_VALIDATION' : 'COMPLETED';

    const storedRun = await step.run('store-result', async () => {
      const run = await prisma.elevayAgentRun.create({
        data: {
          workspaceId,
          agentCode: AGENT_CODE_MAP[agentId],
          status: runStatus,
          output: result.output as unknown as Prisma.InputJsonValue,
          degradedSources: [],
          durationMs: result.durationMs,
          brandProfileId: profile.id,
        },
      });
      return { id: run.id };
    });

    // Send email notification with runId for approve/reject links
    if (isContentDraft) {
      await step.run('send-draft-email', async () => {
        const { sendScheduledDraftAlert } = await import('../../core/tools/notifications');
        const output = result.output as { wpDraftUrl?: string } | null;
        if (output?.wpDraftUrl) {
          await sendScheduledDraftAlert({
            agentName: agentId === 'wpw09' ? 'WPW-09' : 'BSW-10',
            draftUrl: output.wpDraftUrl,
            topic: keywords[0] ?? '',
            keyword: keywords[1] ?? '',
            workspaceId,
            alertChannels: context.clientProfile.alertChannels.length > 0
              ? context.clientProfile.alertChannels
              : ['email'],
            userId: clientId,
            runId: storedRun.id,
          });
        }
      });
    }

    return { success: true, agentId, durationMs: result.durationMs };
  },
);

// ─── Agent router ────────────────────────────────────────

interface AgentRunContext {
  clientProfile: {
    id: string;
    siteUrl: string;
    cmsType: 'wordpress' | 'hubspot' | 'shopify' | 'webflow' | 'other';
    automationLevel: 'audit' | 'semi-auto' | 'full-auto';
    geoLevel: 'national' | 'regional' | 'city' | 'multi-geo';
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
  profile: AgentProfile,
  workspaceId: string,
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
    // ─── Task 1: Content agents (scheduled via KGA-08 recommendations) ─────
    case 'wpw09': {
      const { activate } = await import('../../agents/seo-geo/wpw09/index');
      const enriched = await buildScheduledContentContext(workspaceId, keywords);
      return activate(context, {
        pageType: 'landing',
        brief: enriched.topic,
        targetKeywords: enriched.relatedKeywords.length > 0 ? enriched.relatedKeywords : keywords,
        brandTone: enriched.toneOfVoice,
        targetAudience: enriched.targetAudience,
        internalLinksAvailable: [],
        cmsType: context.clientProfile.cmsType,
        exportFormat: 'markdown',
      }, context.clientProfile.targetGeos[0] ?? 'FR');
    }
    case 'bsw10': {
      const { activate } = await import('../../agents/seo-geo/bsw10/index');
      const enriched = await buildScheduledContentContext(workspaceId, keywords);
      return activate(context, {
        topic: enriched.topic,
        mode: 'single',
        articleFormat: 'guide',
        targetAudience: enriched.targetAudience,
        expertiseLevel: 'intermediate',
        objective: 'traffic',
        brandTone: enriched.toneOfVoice,
        targetKeywords: enriched.relatedKeywords.length > 0 ? enriched.relatedKeywords : keywords,
        internalLinksAvailable: [],
        cta: enriched.primaryCta,
        cmsType: context.clientProfile.cmsType,
      }, context.clientProfile.targetGeos[0] ?? 'FR');
    }
    // ─── Task 2: Brand-intel agents ──────────────────────────────────────────
    case 'bpi01': {
      const { runBpi01 } = await import('../agents/bpi-01/index');
      const result = await runBpi01(profile);
      return { output: result };
    }
    case 'cia03': {
      const { runCia03 } = await import('../agents/cia-03/index');
      const result = await runCia03(profile, {
        priority_channels: ['SEO'],
        objective: 'acquisition',
      });
      return { output: result };
    }
    case 'mts02': {
      const { runMts02 } = await import('../agents/mts-02/index');
      const result = await runMts02(profile, {
        sector: profile.primary_keyword,
        priority_channels: ['SEO', 'LinkedIn', 'YouTube'],
      });
      return { output: result };
    }
    case 'scw16': {
      const { runSCW } = await import('../agents/social-content-writer/index');
      const result = await runSCW(
        { format: 'caption', platforms: ['linkedin'], objective: 'engagement', sourceContent: '', crossPlatform: false, variationsCount: 2 },
        { style: 'professional', register: 'accessible', forbiddenWords: [], keyPhrases: [], positioning: 'brand-expert' },
      );
      return { output: result };
    }
    case 'crm27': {
      const { runCRM } = await import('../agents/crm-campaign-manager/index');
      const result = await runCRM(
        { objective: 'retention', segment: 'all', channel: 'email', platform: 'hubspot', tone: 'informational' },
        { platform: 'hubspot', maxSendsPerContactPerWeek: 3, defaultResend: true, segments: [], historicalOpenRate: 0.20, bestTimings: [] },
      );
      return { output: result };
    }
    case 'bdg32': {
      const { runBDG } = await import('../agents/budget-controller/index');
      const result = await runBDG(
        { annualBudget: 0, channels: [], objectives: { annualRevenue: 0, quarterlyRevenue: [], monthlyLeads: 0 }, kpiTargets: { cplTarget: 0, cacTarget: 0, roiMinimum: 1 }, alertThresholds: { overSpendPercent: 15, cacDeviationWeeks: 3 }, reportFrequency: 'weekly', fiscalYearStart: 1, escalationChannel: 'email' },
        [],
      );
      return { output: result };
    }
    case 'smc19': {
      const { runSMC } = await import('../agents/social-campaign-manager/index');
      const result = await runSMC({
        objective: 'leads', monthlyBudget: 0, platforms: ['meta'], vertical: 'saas',
        audience: '', product: '', kpis: [], autonomyLevel: 'supervised',
        budgetConstraints: { minDailySpend: 0, maxDailySpend: 0, testBudgetCap: 10 },
      });
      return { output: result };
    }
    case 'smi20': {
      // SMI-20 is event-driven (webhooks), not scheduled. Stub for type completeness.
      return { output: { agentCode: 'SMI-20', message: 'SMI-20 is event-driven, not scheduled' } };
    }
    default: {
      const _exhaustive: never = agentId;
      throw new Error(`Unknown agent: ${_exhaustive}`);
    }
  }
}

// ─── Enrichment for scheduled content agents ─────────────

interface ScheduledContentContext {
  topic: string;
  targetAudience: string;
  toneOfVoice: string;
  primaryCta: string;
  relatedKeywords: string[];
}

async function buildScheduledContentContext(
  workspaceId: string,
  fallbackKeywords: string[],
): Promise<ScheduledContentContext> {
  // Load brand profile for enrichment
  const bp = await prisma.elevayBrandProfile.findFirst({
    where: { workspaceId },
    select: {
      brand_name: true,
      sector: true,
      primary_keyword: true,
      secondary_keyword: true,
      objective: true,
    },
  });

  // Load KGA-08 last session for topic + keyword context
  const kga08History = await getLatestOutputByAgent(workspaceId, 'KGA-08');
  const kgaPayload = kga08History?.payload as {
    actionPlan?: { month1?: { keyword?: string; trafficPotential?: number }[] };
    kwScores?: { keyword?: string }[];
  } | undefined;

  const kgaTopic = kgaPayload?.actionPlan?.month1?.[0]?.keyword ?? '';
  const kgaRelated = (kgaPayload?.kwScores ?? [])
    .map((k) => k.keyword)
    .filter((k): k is string => Boolean(k))
    .slice(0, 5);

  return {
    topic: kgaTopic || bp?.primary_keyword || fallbackKeywords[0] || '',
    targetAudience: bp?.objective === 'lead-gen' ? 'décideurs B2B' : 'marketeurs',
    toneOfVoice: 'professionnel',
    primaryCta: bp?.sector
      ? `Découvrir nos solutions ${bp.sector}`
      : 'Découvrir notre solution',
    relatedKeywords: kgaRelated,
  };
}

