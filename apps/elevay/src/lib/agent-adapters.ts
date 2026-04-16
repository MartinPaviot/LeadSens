import type { AdapterResult, WorkspaceContext } from '@/lib/agent-context'
import { hasIntegration } from '@/lib/agent-context'
import type { AgentProfile } from '@/agents/_shared/types'
import type { BudgetConfig, ChannelBudget } from '@/agents/budget-controller/core/types'
import type { CRMConfig } from '@/agents/crm-campaign-manager/core/types'
import type { BrandVoiceProfile } from '@/agents/social-content-writer/core/types'
import type { InteractionConfig } from '@/agents/social-interaction-manager/core/types'
import type { CampaignBrief as SocialCampaignBrief } from '@/agents/social-campaign-manager/core/types'

type Missing = string[]

function push(missing: Missing, field: string, value: unknown): boolean {
  const empty =
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  if (empty) missing.push(field)
  return !empty
}

// ─── Brand-intel: AgentProfile (BPI/CIA/MTS) ─────────────────────────

export function toAgentProfile(ctx: WorkspaceContext): AdapterResult<AgentProfile> {
  const s = ctx.settings
  const missing: Missing = []

  push(missing, 'name', ctx.name)
  push(missing, 'companyUrl', ctx.companyUrl)
  push(missing, 'country', ctx.country)
  push(missing, 'primaryKeyword', s.primaryKeyword)
  push(missing, 'secondaryKeyword', s.secondaryKeyword)

  const competitors = (s.competitors ?? []).filter((c) => c.name && c.url)

  return {
    data: {
      workspaceId: ctx.workspaceId,
      brand_name: ctx.name,
      brand_url: ctx.companyUrl ?? '',
      country: ctx.country ?? '',
      language: s.language ?? 'en',
      competitors,
      primary_keyword: s.primaryKeyword ?? '',
      secondary_keyword: s.secondaryKeyword ?? '',
      sector: ctx.industry ?? undefined,
      priority_channels: s.priorityChannels,
      objective: s.businessObjective || undefined,
      facebookConnected: hasIntegration(ctx, 'facebook'),
      facebookComposioAccountId: ctx.integrations.find((i) => i.type === 'facebook')?.accountEmail ?? undefined,
      instagramConnected: hasIntegration(ctx, 'instagram'),
      instagramComposioAccountId: ctx.integrations.find((i) => i.type === 'instagram')?.accountEmail ?? undefined,
    },
    missing,
  }
}

// ─── SEO-GEO: ClientProfile + per-agent inputs ───────────────────────

type CmsType = 'wordpress' | 'hubspot' | 'shopify' | 'webflow' | 'other'
type GeoLevel = 'national' | 'regional' | 'city' | 'multi-geo'
type AlertChannel = 'slack' | 'email' | 'report'
type AutomationLevelSeo = 'audit' | 'semi-auto' | 'full-auto'

export interface SeoClientProfile {
  id: string
  siteUrl: string
  cmsType: CmsType
  automationLevel: AutomationLevelSeo
  geoLevel: GeoLevel
  targetGeos: string[]
  priorityPages: string[]
  alertChannels: AlertChannel[]
  connectedTools: {
    gsc: boolean
    ga: boolean
    ahrefs: boolean
    semrush: boolean
  }
}

/**
 * SEO-GEO ClientProfile. Uses workspaceId as `id` (legacy).
 */
export function toClientProfile(ctx: WorkspaceContext): AdapterResult<SeoClientProfile> {
  const s = ctx.settings
  const missing: Missing = []

  push(missing, 'companyUrl', ctx.companyUrl)
  push(missing, 'cmsType', s.cmsType)
  push(missing, 'geoLevel', s.geoLevel)
  push(missing, 'targetGeos', s.targetGeos)

  return {
    data: {
      id: ctx.workspaceId,
      siteUrl: ctx.companyUrl ?? '',
      cmsType: (s.cmsType || 'other') as CmsType,
      automationLevel: (s.automationSeo ?? 'semi-auto') as AutomationLevelSeo,
      geoLevel: (s.geoLevel || 'national') as GeoLevel,
      targetGeos: s.targetGeos ?? [],
      priorityPages: s.priorityPages ?? [],
      alertChannels: s.alertChannel ? [s.alertChannel as AlertChannel] : ['email'],
      connectedTools: {
        gsc: hasIntegration(ctx, 'gsc'),
        ga: hasIntegration(ctx, 'ga'),
        ahrefs: hasIntegration(ctx, 'ahrefs'),
        semrush: hasIntegration(ctx, 'semrush'),
      },
    },
    missing,
  }
}

/**
 * Extra inputs specific to KGA-08 (keyword planner).
 * Pulls businessObjective, capacity, maturity, prioritization from Settings
 * instead of hardcoding.
 */
export interface Kga08Settings {
  businessObjective: 'traffic' | 'lead-gen' | 'sales' | 'local-awareness'
  monthlyContentCapacity: number
  seoMaturity: 'beginner' | 'intermediate' | 'advanced'
  prioritization: 'volume' | 'conversion'
  competitors: string[] // URLs
}

export function toKga08Settings(ctx: WorkspaceContext): AdapterResult<Kga08Settings> {
  const s = ctx.settings
  const missing: Missing = []

  push(missing, 'businessObjective', s.businessObjective)

  const competitors = (s.competitors ?? []).map((c) => c.url).filter(Boolean)

  return {
    data: {
      businessObjective: (s.businessObjective || 'traffic') as Kga08Settings['businessObjective'],
      monthlyContentCapacity: s.monthlyContentCapacity ?? 4,
      seoMaturity: (s.seoMaturity || 'beginner') as Kga08Settings['seoMaturity'],
      prioritization: (s.prioritization || 'volume') as Kga08Settings['prioritization'],
      competitors,
    },
    missing,
  }
}

// ─── Budget-controller: BudgetConfig ─────────────────────────────────

export function toBudgetConfig(ctx: WorkspaceContext): AdapterResult<BudgetConfig> {
  const s = ctx.settings
  const missing: Missing = []

  push(missing, 'annualBudget', s.annualBudget)
  push(missing, 'channelsAllocation', s.channelsAllocation)
  push(missing, 'kpiTargets.cplTarget', s.kpiTargets?.cplTarget)
  push(missing, 'kpiTargets.cacTarget', s.kpiTargets?.cacTarget)
  push(missing, 'revenueObjectives.annualRevenue', s.revenueObjectives?.annualRevenue)

  const channels: ChannelBudget[] = (s.channelsAllocation ?? []).map((c) => ({
    channel: c.channel,
    annualBudget: c.annualBudget,
    monthlyBudget: c.monthlyBudget,
  }))

  const fiscalMonth = parseFiscalMonth(s.fiscalYearStart)

  return {
    data: {
      annualBudget: s.annualBudget ?? 0,
      channels,
      objectives: {
        annualRevenue: s.revenueObjectives?.annualRevenue ?? 0,
        quarterlyRevenue: s.revenueObjectives?.quarterlyRevenue ?? [0, 0, 0, 0],
        monthlyLeads: s.revenueObjectives?.monthlyLeads ?? 0,
      },
      kpiTargets: {
        cplTarget: s.kpiTargets?.cplTarget ?? 0,
        cacTarget: s.kpiTargets?.cacTarget ?? 0,
        roiMinimum: s.kpiTargets?.roiMinimum ?? 0,
      },
      alertThresholds: {
        overSpendPercent: s.alertThresholds?.overSpendPercent ?? 15,
        cacDeviationWeeks: s.alertThresholds?.cacDeviationWeeks ?? 2,
      },
      reportFrequency: s.reportSchedule === 'monthly' ? 'monthly' : 'weekly',
      fiscalYearStart: fiscalMonth,
      escalationChannel: (s.escalationChannel ?? 'email') as BudgetConfig['escalationChannel'],
    },
    missing,
  }
}

function parseFiscalMonth(input: string | undefined): number {
  if (!input) return 1
  const match = /^(\d{2})-\d{2}$/.exec(input)
  if (!match) return 1
  const month = Number(match[1])
  return month >= 1 && month <= 12 ? month : 1
}

// ─── CRM-campaign-manager: CRMConfig ─────────────────────────────────

/**
 * Build a `CRMConfig` from Settings. Many fields (segments, historical
 * open rate, best timings) don't live in Settings — they come from the
 * CRM platform at run time via `collectCRMConfig`. This adapter only
 * provides the static policy: platform, caps, escalation.
 */
export function toCRMConfig(ctx: WorkspaceContext): AdapterResult<CRMConfig> {
  const s = ctx.settings
  const missing: Missing = []

  // Platform comes from active CRM integration; fall back to legacy config.
  const legacy = (s.crmConfig ?? {}) as Partial<CRMConfig>
  const activeCrm = ctx.integrations.find((i) =>
    ['hubspot', 'klaviyo', 'brevo', 'salesforce', 'pipedrive'].includes(i.type),
  )
  const platform = (activeCrm?.type ?? legacy.platform) as CRMConfig['platform'] | undefined
  if (!platform || !['hubspot', 'klaviyo', 'brevo'].includes(platform)) {
    missing.push('platform (connect a CRM integration)')
  }

  return {
    data: {
      platform: (platform ?? 'hubspot') as CRMConfig['platform'],
      smsPlatform: legacy.smsPlatform,
      maxSendsPerContactPerWeek: legacy.maxSendsPerContactPerWeek ?? 3,
      defaultResend: legacy.defaultResend ?? false,
      alertThreshold: legacy.alertThreshold,
      segments: legacy.segments ?? [],
      historicalOpenRate: legacy.historicalOpenRate ?? 0,
      bestTimings: legacy.bestTimings ?? [],
    },
    missing,
  }
}

// ─── Social-content-writer: BrandVoiceProfile ─────────────────────────

export function toBrandVoiceProfile(ctx: WorkspaceContext): AdapterResult<BrandVoiceProfile> {
  const s = ctx.settings
  const missing: Missing = []

  push(missing, 'style', s.style)
  push(missing, 'positioning', s.positioning)

  const forbiddenWords = parseList(s.neverMention)
  const positioning = (s.positioning || 'brand-expert') as BrandVoiceProfile['positioning']

  return {
    data: {
      style: s.style ?? '',
      register: s.register ?? 'professional',
      forbiddenWords,
      keyPhrases: s.keyPhrases ?? [],
      positioning,
      platformOverrides: s.platformOverrides as BrandVoiceProfile['platformOverrides'] | undefined,
      examplePosts: s.examplePosts,
    },
    missing,
  }
}

function parseList(input: string | undefined): string[] {
  if (!input) return []
  return input
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// ─── Social-interaction-manager: InteractionConfig ────────────────────

type SMIPlatform = InteractionConfig['platforms'][number]

export function toInteractionConfig(ctx: WorkspaceContext): AdapterResult<InteractionConfig> {
  const s = ctx.settings
  const missing: Missing = []

  const platforms: SMIPlatform[] = (s.priorityChannels ?? [])
    .map((c) => c.toLowerCase())
    .filter((c): c is SMIPlatform =>
      ['instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'reddit'].includes(c),
    )

  if (platforms.length === 0) missing.push('priorityChannels')

  const th = s.escalationThresholds ?? {}

  const helpdesk = ctx.integrations.find((i) => ['zendesk', 'freshdesk'].includes(i.type))?.type as
    | InteractionConfig['helpdeskTool']
    | undefined
  const crm = ctx.integrations.find((i) => ['hubspot', 'salesforce', 'pipedrive'].includes(i.type))?.type as
    | InteractionConfig['crmTool']
    | undefined

  return {
    data: {
      platforms,
      brandTone: {
        description: s.style ?? s.tone ?? 'professional',
        examples: s.examplePosts ?? [],
        forbiddenWords: parseList(s.neverMention),
      },
      automationLevel: (s.automationInteraction ?? 'validation') as InteractionConfig['automationLevel'],
      offHoursSchedule: s.offHoursEnabled
        ? {
            timezone: ctx.timezone,
            workStart: s.workStart ?? '09:00',
            workEnd: s.workEnd ?? '18:00',
            workDays: s.workDays ?? [1, 2, 3, 4, 5],
          }
        : undefined,
      spamDeletion: s.spamDeletion ?? true,
      escalationThresholds: {
        sentimentMin: th.sentimentMin ?? -0.5,
        influencerAudienceMin: th.influencerAudienceMin ?? 10000,
        leadScoreMin: th.leadScoreMin ?? 70,
      },
      crmTool: crm ?? null,
      helpdeskTool: helpdesk ?? null,
      escalationChannel: (s.escalationChannel ?? 'email') as InteractionConfig['escalationChannel'],
    },
    missing,
  }
}

// ─── Social-campaign-manager: brief defaults ─────────────────────────

type SocialPlatform = SocialCampaignBrief['platforms'][number]

export function toSocialCampaignDefaults(
  ctx: WorkspaceContext,
): AdapterResult<Partial<SocialCampaignBrief>> {
  const s = ctx.settings
  const missing: Missing = []

  push(missing, 'vertical', s.vertical)
  push(missing, 'audienceDescription', s.audienceDescription)
  push(missing, 'productDescription', s.productDescription)
  push(missing, 'monthlyAdsBudget', s.monthlyAdsBudget)

  const platforms: SocialPlatform[] = (s.priorityChannels ?? [])
    .map((c) => c.toLowerCase())
    .filter((c): c is SocialPlatform =>
      ['google', 'meta', 'linkedin', 'x', 'tiktok'].includes(c),
    )

  const kpis: string[] = []
  if (s.kpiTargets?.cpaTarget) kpis.push(`CPA < ${s.kpiTargets.cpaTarget}`)
  if (s.kpiTargets?.roasTarget) kpis.push(`ROAS > ${s.kpiTargets.roasTarget}`)

  return {
    data: {
      monthlyBudget: s.monthlyAdsBudget,
      platforms: platforms.length > 0 ? platforms : undefined,
      vertical: (s.vertical || undefined) as SocialCampaignBrief['vertical'] | undefined,
      audience: s.audienceDescription,
      product: s.productDescription,
      kpis: kpis.length > 0 ? kpis : undefined,
      autonomyLevel: (s.automationSocial ?? 'supervised') as SocialCampaignBrief['autonomyLevel'],
    },
    missing,
  }
}

// ─── Influence: brief defaults ────────────────────────────────────────

export interface InfluenceBriefDefaults {
  sector?: string
  geography?: string
  platforms?: Array<'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'x'>
  budgetMin?: number
  budgetMax?: number
  language?: string
}

export function toInfluenceBriefDefaults(
  ctx: WorkspaceContext,
): AdapterResult<InfluenceBriefDefaults> {
  const s = ctx.settings
  const missing: Missing = []

  push(missing, 'industry', ctx.industry)

  const geos = s.targetGeos ?? []
  const geography = geos.length > 0 ? geos.join(', ') : ctx.country ?? undefined

  const platforms = (s.priorityChannels ?? [])
    .map((c) => c.toLowerCase())
    .filter((c): c is 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'x' =>
      ['instagram', 'tiktok', 'youtube', 'linkedin', 'x'].includes(c),
    )

  const monthly = s.monthlyAdsBudget
  const budgetMin = monthly ? Math.round(monthly * 0.6) : undefined
  const budgetMax = monthly ? Math.round(monthly * 1.4) : undefined

  return {
    data: {
      sector: ctx.industry ?? undefined,
      geography,
      platforms: platforms.length > 0 ? platforms : undefined,
      budgetMin,
      budgetMax,
      language: s.language,
    },
    missing,
  }
}
