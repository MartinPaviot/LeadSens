import { z } from "zod"
import { callLLM } from "@/agents/_shared/llm"
import type {
  CampaignBrief,
  BudgetAllocation,
  CampaignStructure,
  PlatformBudget,
  AudienceConfig,
  CreativeConfig,
  KpiTarget,
} from "../core/types"
import {
  getDiagnosticPrompt,
  buildDiagnosticUserPrompt,
} from "../core/prompts"

// ── Zod Schemas ────────────────────────────────────────

const PlatformSchema = z.enum(["google", "meta", "linkedin", "x", "tiktok"])
const VerticalSchema = z.enum(["ecommerce", "b2b", "saas", "personal-branding"])
const AutonomySchema = z.enum(["full-auto", "supervised", "manual"])
const ObjectiveSchema = z.enum([
  "awareness",
  "traffic",
  "leads",
  "conversions",
  "app-installs",
  "engagement",
])

export const CampaignBriefSchema = z.object({
  objective: ObjectiveSchema,
  monthlyBudget: z.number().positive(),
  platforms: z.array(PlatformSchema).min(1),
  vertical: VerticalSchema,
  audience: z.string().min(1),
  product: z.string().min(1),
  kpis: z.array(z.string()).min(1),
  autonomyLevel: AutonomySchema,
  budgetConstraints: z.object({
    minDailySpend: z.number().min(0),
    maxDailySpend: z.number().positive(),
    testBudgetCap: z.number().min(0).max(100),
  }),
})

// ── LLM Response Validation ────────────────────────────

interface DiagnosticLLMResponse {
  budgetAllocation: {
    split: { cold: number; retargeting: number; scaling: number; tests: number }
    byPlatform: Array<{ platform: string; amount: number; percentage: number }>
    totalMonthly: number
  }
  campaigns: Array<{
    platform: string
    name: string
    type: string
    budget: number
    audience: { name: string; targeting: string; estimatedSize?: string }
    creatives: Array<{
      headline: string
      body: string
      cta: string
      format: string
    }>
    kpiTargets: Array<{ metric: string; target: number; unit: string }>
    status?: string
  }>
  strategySummary?: string
}

function isDiagnosticResponse(v: unknown): v is DiagnosticLLMResponse {
  if (!v || typeof v !== "object") return false
  const obj = v as Record<string, unknown>
  return (
    typeof obj["budgetAllocation"] === "object" &&
    obj["budgetAllocation"] !== null &&
    Array.isArray(obj["campaigns"])
  )
}

// ── Parse & Generate ───────────────────────────────────

export function parseCampaignBrief(input: unknown): CampaignBrief {
  return CampaignBriefSchema.parse(input)
}

export async function runDiagnostic(
  brief: CampaignBrief,
  language: string = "en",
): Promise<{
  budgetAllocation: BudgetAllocation
  campaigns: CampaignStructure[]
  summary: string
}> {
  const response = await callLLM({
    system: getDiagnosticPrompt(language),
    user: buildDiagnosticUserPrompt(brief),
    maxTokens: 4096,
    temperature: 0.4,
  })

  if (!isDiagnosticResponse(response.parsed)) {
    return {
      budgetAllocation: buildFallbackAllocation(brief),
      campaigns: [],
      summary: "Strategy generation returned an unexpected format. Using default budget allocation.",
    }
  }

  const raw = response.parsed

  const byPlatform: PlatformBudget[] = raw.budgetAllocation.byPlatform.map((p) => ({
    platform: p.platform as CampaignBrief["platforms"][number],
    amount: p.amount,
    percentage: p.percentage,
  }))

  const budgetAllocation: BudgetAllocation = {
    split: {
      cold: raw.budgetAllocation.split.cold,
      retargeting: raw.budgetAllocation.split.retargeting,
      scaling: raw.budgetAllocation.split.scaling,
      tests: raw.budgetAllocation.split.tests,
    },
    byPlatform,
    totalMonthly: raw.budgetAllocation.totalMonthly,
  }

  const campaigns: CampaignStructure[] = raw.campaigns.map((c) => ({
    platform: c.platform as CampaignBrief["platforms"][number],
    name: c.name,
    type: c.type as CampaignStructure["type"],
    budget: c.budget,
    audience: c.audience as AudienceConfig,
    creatives: c.creatives.map(
      (cr): CreativeConfig => ({
        headline: cr.headline,
        body: cr.body,
        cta: cr.cta,
        format: cr.format as CreativeConfig["format"],
      }),
    ),
    kpiTargets: c.kpiTargets.map(
      (k): KpiTarget => ({
        metric: k.metric,
        target: k.target,
        unit: k.unit,
      }),
    ),
    status: "draft",
  }))

  return {
    budgetAllocation,
    campaigns,
    summary: raw.strategySummary ?? "Strategy generated successfully.",
  }
}

function buildFallbackAllocation(brief: CampaignBrief): BudgetAllocation {
  const perPlatform = brief.monthlyBudget / brief.platforms.length
  return {
    split: { cold: 40, retargeting: 25, scaling: 25, tests: 10 },
    byPlatform: brief.platforms.map((p) => ({
      platform: p,
      amount: Math.round(perPlatform),
      percentage: Math.round(100 / brief.platforms.length),
    })),
    totalMonthly: brief.monthlyBudget,
  }
}
