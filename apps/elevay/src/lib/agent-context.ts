import { prisma } from '@/lib/prisma'

/**
 * Unified workspace context loaded once per agent request.
 * Holds everything an agent might need: workspace columns, settings JSON
 * (flat shape from /api/settings), and active integrations.
 *
 * Shapes mirror what the Settings UI persists. Fields are optional so
 * adapters can compute their own `missing` lists when validating.
 */
export interface WorkspaceContext {
  workspaceId: string

  // Columns on `workspace` table
  name: string
  slug: string
  companyUrl: string | null
  industry: string | null
  size: string | null
  country: string | null
  description: string | null
  valueProp: string | null
  targetMarkets: string[]
  timezone: string
  dryRunMode: boolean
  autonomyLevel: string

  // Flat settings JSON — union of all tabs we wrote to in the Settings UI.
  settings: {
    // Brand voice tab
    language?: string
    tone?: string
    emailSignature?: string
    neverMention?: string
    approvedExamples?: string
    style?: string
    register?: string
    positioning?: 'thought-leader' | 'brand-expert' | 'personal-brand' | 'corporate' | ''
    keyPhrases?: string[]
    examplePosts?: string[]
    platformOverrides?: Record<string, { length?: string; tone?: string; hashtags?: boolean; ctaType?: string }>
    vertical?: 'ecommerce' | 'b2b' | 'saas' | 'personal-branding' | ''
    audienceDescription?: string
    productDescription?: string
    priorityChannels?: string[]

    // Competitive intelligence tab
    competitors?: Array<{ name: string; url: string }>
    industryVerticals?: string[]
    monitorKeywords?: string[]
    excludedSectors?: string[]

    // SEO & Site tab
    cmsType?: 'wordpress' | 'hubspot' | 'shopify' | 'webflow' | 'other' | ''
    geoLevel?: 'national' | 'regional' | 'city' | 'multi-geo' | ''
    targetGeos?: string[]
    priorityPages?: string[]
    googleBusinessProfileId?: string
    seoMaturity?: 'beginner' | 'intermediate' | 'advanced' | ''
    monthlyContentCapacity?: number
    prioritization?: 'volume' | 'conversion' | ''
    primaryKeyword?: string
    secondaryKeyword?: string
    businessObjective?: 'traffic' | 'lead-gen' | 'sales' | 'local-awareness' | ''
    alertChannel?: 'slack' | 'email' | 'report' | ''

    // Budget & Objectives tab
    annualBudget?: number
    monthlyAdsBudget?: number
    smsBudget?: number
    fiscalYearStart?: string
    channelsAllocation?: Array<{ channel: string; annualBudget: number; monthlyBudget: number }>
    kpiTargets?: {
      cplTarget?: number
      cacTarget?: number
      roiMinimum?: number
      cpaTarget?: number
      roasTarget?: number
    }
    revenueObjectives?: {
      annualRevenue?: number
      quarterlyRevenue?: number[]
      monthlyLeads?: number
    }
    alertThresholds?: {
      overSpendPercent?: number
      cacDeviationWeeks?: number
    }

    // Automation & Escalation tab
    reportSchedule?: string
    contentApprovalRequired?: boolean
    automationSeo?: 'audit' | 'semi-auto' | 'full-auto'
    automationSocial?: 'full-auto' | 'supervised' | 'manual'
    automationCrm?: 'full-auto' | 'supervised' | 'manual'
    automationInteraction?: 'full-auto' | 'validation' | 'off-hours'
    offHoursEnabled?: boolean
    workStart?: string
    workEnd?: string
    workDays?: number[]
    spamDeletion?: boolean
    escalationChannel?: 'email' | 'slack' | 'sms'
    alertChannels?: Array<'email' | 'slack' | 'report'>
    escalationThresholds?: {
      sentimentMin?: number
      influencerAudienceMin?: number
      leadScoreMin?: number
    }

    // Legacy nested shapes (tolerated during migration)
    budgetConfig?: Record<string, unknown>
    crmConfig?: Record<string, unknown>
    socialConnections?: Record<string, boolean>

    // Unknown / future fields
    [key: string]: unknown
  }

  integrations: Array<{
    type: string      // lowercase key: 'gsc', 'ga', 'linkedin', 'facebook', ...
    status: string    // 'ACTIVE' | 'ERROR' | ...
    accountEmail: string | null
    accountName: string | null
  }>
}

/**
 * Load everything an agent route needs in a single DB round-trip.
 * Throws if the workspace doesn't exist — callers should already have
 * validated the session and resolved `workspaceId`.
 */
export async function loadWorkspaceContext(workspaceId: string): Promise<WorkspaceContext> {
  const [workspace, integrations] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true, name: true, slug: true, companyUrl: true, industry: true,
        size: true, country: true, description: true, valueProp: true,
        targetMarkets: true, timezone: true, dryRunMode: true, autonomyLevel: true,
        settings: true,
      },
    }),
    prisma.integration.findMany({
      where: { workspaceId, status: 'ACTIVE' },
      select: { type: true, status: true, accountEmail: true, accountName: true },
    }),
  ])

  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found`)
  }

  const settings = (workspace.settings as WorkspaceContext['settings'] | null) ?? {}

  return {
    workspaceId: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    companyUrl: workspace.companyUrl,
    industry: workspace.industry,
    size: workspace.size,
    country: workspace.country,
    description: workspace.description,
    valueProp: workspace.valueProp,
    targetMarkets: workspace.targetMarkets,
    timezone: workspace.timezone ?? 'Europe/Paris',
    dryRunMode: workspace.dryRunMode,
    autonomyLevel: workspace.autonomyLevel,
    settings,
    integrations: integrations.map((i) => ({
      type: i.type.toLowerCase(),
      status: i.status,
      accountEmail: i.accountEmail,
      accountName: i.accountName,
    })),
  }
}

export function hasIntegration(ctx: WorkspaceContext, type: string): boolean {
  return ctx.integrations.some((i) => i.type === type.toLowerCase() && i.status === 'ACTIVE')
}

/**
 * Thrown when an adapter finds required fields missing.
 * Routes catch it and return 400 `NO_CONFIG` with the list of missing fields
 * and the settings tab where the user should fix the problem.
 */
export class NoConfigError extends Error {
  readonly missing: string[]
  readonly tab: string
  constructor(missing: string[], tab: string) {
    super(`Missing required settings: ${missing.join(', ')}`)
    this.name = 'NoConfigError'
    this.missing = missing
    this.tab = tab
  }
}

/**
 * Adapter result. `data` is always the best-effort shape (even partial).
 * `missing` lists fields the caller must check if it wants to enforce
 * completeness. Routes call `requireFields` to convert missing into
 * a `NoConfigError`.
 */
export interface AdapterResult<T> {
  data: T
  missing: string[]
}

export function requireFields<T>(result: AdapterResult<T>, tab: string): T {
  if (result.missing.length > 0) {
    throw new NoConfigError(result.missing, tab)
  }
  return result.data
}

/**
 * Convert a NoConfigError into the standard 400 response body.
 * Use in route `catch` blocks.
 */
export function noConfigResponse(err: NoConfigError): Response {
  return Response.json(
    {
      error: 'NO_CONFIG',
      missing: err.missing,
      tab: err.tab,
      message: `Please configure these fields in Settings → ${err.tab}: ${err.missing.join(', ')}`,
    },
    { status: 400 },
  )
}
