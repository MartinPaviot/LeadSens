"use client"

import { useState, useCallback } from "react"
import type {
  StrategyOutput,
  CampaignStructure,
  BudgetAllocation,
  Platform,
  Vertical,
  CampaignObjective,
  AutonomyLevel,
} from "@/agents/social-campaign-manager/core/types"
import { PLATFORM_META, VERTICAL_CONFIGS } from "@/agents/social-campaign-manager/core/constants"
import { NoConfigBanner } from "@/components/ui-brand-intel/no-config-banner"
import { checkNoConfig, type NoConfigInfo } from "@/lib/no-config-check"
import { PageHeader } from "@/components/shared/PageHeader"
import { toast } from "sonner"

// ── Constants for pill selectors ───────────────────────

const OBJECTIVES: Array<{ value: CampaignObjective; label: string }> = [
  { value: "awareness", label: "Awareness" },
  { value: "traffic", label: "Traffic" },
  { value: "leads", label: "Leads" },
  { value: "conversions", label: "Conversions" },
  { value: "engagement", label: "Engagement" },
  { value: "app-installs", label: "App Installs" },
]

const PLATFORMS: Array<{ value: Platform; label: string }> = [
  { value: "google", label: "Google Ads" },
  { value: "meta", label: "Meta" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X" },
  { value: "tiktok", label: "TikTok" },
]

const VERTICALS: Array<{ value: Vertical; label: string }> = [
  { value: "ecommerce", label: "E-commerce" },
  { value: "b2b", label: "B2B" },
  { value: "saas", label: "SaaS" },
  { value: "personal-branding", label: "Personal Brand" },
]

const AUTONOMY_LEVELS: Array<{ value: AutonomyLevel; label: string; desc: string }> = [
  { value: "full-auto", label: "Full Auto", desc: "Agent executes autonomously" },
  { value: "supervised", label: "Supervised", desc: "Agent proposes, you approve" },
  { value: "manual", label: "Manual", desc: "Agent advises, you execute" },
]

type ViewState = "idle" | "loading" | "done" | "error"

// ── Pill Selector Component ────────────────────────────

function PillSelector<T extends string>({
  label,
  options,
  selected,
  onToggle,
  multi = false,
}: {
  label: string
  options: Array<{ value: T; label: string }>
  selected: T[]
  onToggle: (value: T) => void
  multi?: boolean
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground/80">
        {label}
        {multi && <span className="text-xs text-muted-foreground ml-1">(select multiple)</span>}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isActive = selected.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                isActive
                  ? "bg-teal-500/10 border-teal-500/50 text-teal-600 dark:text-teal-400"
                  : "bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:border-border/80"
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Campaign Card Component ────────────────────────────

function CampaignCard({ campaign }: { campaign: CampaignStructure }) {
  const platformMeta = PLATFORM_META[campaign.platform]

  const typeColors: Record<string, string> = {
    cold: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    retargeting: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    scaling: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
    test: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{campaign.name}</span>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full border font-medium ${typeColors[campaign.type] ?? "bg-muted text-muted-foreground"}`}
        >
          {campaign.type}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{platformMeta.label}</span>
        <span className="text-foreground/40">|</span>
        <span>{campaign.budget} EUR/mo</span>
        <span className="text-foreground/40">|</span>
        <span>{campaign.audience.name}</span>
      </div>

      {campaign.kpiTargets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {campaign.kpiTargets.map((kpi, i) => (
            <span
              key={i}
              className="text-[10px] px-2 py-0.5 rounded-full bg-muted/70 text-muted-foreground"
            >
              {kpi.metric}: {kpi.target}{kpi.unit}
            </span>
          ))}
        </div>
      )}

      {campaign.creatives.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {campaign.creatives.length} creative{campaign.creatives.length > 1 ? "s" : ""}
          {" "}({campaign.creatives.map((c) => c.format).join(", ")})
        </div>
      )}
    </div>
  )
}

// ── Budget Visualization ───────────────────────────────

function BudgetViz({ allocation }: { allocation: BudgetAllocation }) {
  const splitColors: Record<string, string> = {
    cold: "#3b82f6",
    retargeting: "#8b5cf6",
    scaling: "#22c55e",
    tests: "#f59e0b",
  }

  const splitEntries = Object.entries(allocation.split) as Array<[string, number]>

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <h3 className="text-sm font-semibold">Budget Allocation</h3>

      {/* Split bar */}
      <div>
        <div className="text-xs text-muted-foreground mb-1.5">Strategy Split</div>
        <div className="flex h-3 rounded-full overflow-hidden">
          {splitEntries.map(([key, pct]) => (
            <div
              key={key}
              style={{ width: `${pct}%`, backgroundColor: splitColors[key] ?? "#94a3b8" }}
              title={`${key}: ${pct}%`}
            />
          ))}
        </div>
        <div className="flex gap-3 mt-2">
          {splitEntries.map(([key, pct]) => (
            <div key={key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: splitColors[key] ?? "#94a3b8" }}
              />
              {key} {pct}%
            </div>
          ))}
        </div>
      </div>

      {/* Platform breakdown */}
      <div>
        <div className="text-xs text-muted-foreground mb-1.5">By Platform</div>
        <div className="space-y-1.5">
          {allocation.byPlatform.map((pb) => (
            <div key={pb.platform} className="flex items-center gap-2 text-xs">
              <span className="w-20 font-medium text-foreground/80">
                {PLATFORM_META[pb.platform].label}
              </span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-teal-500/70"
                  style={{ width: `${pb.percentage}%` }}
                />
              </div>
              <span className="w-16 text-right text-muted-foreground">
                {pb.amount} EUR
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted-foreground pt-1 border-t">
        Total: {allocation.totalMonthly} EUR/month
      </div>
    </div>
  )
}

// ── Empty State ────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-teal-500/10 flex items-center justify-center mb-4">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-teal-500"
        >
          <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold mb-1">Social Campaign Manager</h3>
      <p className="text-sm text-muted-foreground max-w-md">
        Configure your campaign brief below and generate a complete paid + organic strategy across all your platforms.
      </p>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────

export function MissionControl() {
  const [state, setState] = useState<ViewState>("idle")
  const [output, setOutput] = useState<StrategyOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [noConfig, setNoConfig] = useState<NoConfigInfo | null>(null)

  // Brief form state
  const [objective, setObjective] = useState<CampaignObjective>("leads")
  const [platforms, setPlatforms] = useState<Platform[]>(["meta", "google"])
  const [vertical, setVertical] = useState<Vertical>("saas")
  const [autonomy, setAutonomy] = useState<AutonomyLevel>("supervised")
  const [budget, setBudget] = useState("3000")
  const [audience, setAudience] = useState("")
  const [product, setProduct] = useState("")

  const togglePlatform = useCallback((p: Platform) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    )
  }, [])

  const toggleObjective = useCallback((o: CampaignObjective) => {
    setObjective(o)
  }, [])

  const toggleVertical = useCallback((v: Vertical) => {
    setVertical(v)
  }, [])

  const toggleAutonomy = useCallback((a: AutonomyLevel) => {
    setAutonomy(a)
  }, [])

  const handleGenerate = useCallback(async () => {
    if (platforms.length === 0) {
      toast.error("Select at least one platform")
      return
    }
    if (!audience.trim()) {
      toast.error("Describe your target audience")
      return
    }
    if (!product.trim()) {
      toast.error("Describe your product or service")
      return
    }

    const monthlyBudget = Number(budget)
    if (!monthlyBudget || monthlyBudget <= 0) {
      toast.error("Enter a valid monthly budget")
      return
    }

    setState("loading")
    setError(null)
    setNoConfig(null)

    try {
      const response = await fetch("/api/agents/social-campaign-manager/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective,
          monthlyBudget,
          platforms,
          vertical,
          audience,
          product,
          kpis: VERTICAL_CONFIGS[vertical].primaryKpis,
          autonomyLevel: autonomy,
          budgetConstraints: {
            minDailySpend: 5,
            maxDailySpend: Math.round(monthlyBudget / 20),
            testBudgetCap: 15,
          },
        }),
      })

      const nc = await checkNoConfig(response)
      if (nc) { setNoConfig(nc); setState("error"); return }

      if (!response.ok) {
        const err = await response.json()
        throw new Error(
          (err as Record<string, string>).error ?? "Strategy generation failed",
        )
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response stream")

      const decoder = new TextDecoder()
      let buf = ""

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })

        const lines = buf.split("\n")
        buf = lines.pop() ?? ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6)) as Record<string, unknown>
              if ("result" in data) {
                setOutput(data.result as StrategyOutput)
                setState("done")
              }
              if ("message" in data && typeof data.message === "string") {
                // Status updates could be shown in UI
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      }

      if (state !== "done") setState("done")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setState("error")
      toast.error("Strategy generation failed")
    }
  }, [objective, platforms, vertical, autonomy, budget, audience, product, state])

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Social Campaigns"
        actions={output ? (
          <span className="text-xs text-muted-foreground">
            {output.campaigns.length} campaign{output.campaigns.length !== 1 ? "s" : ""} generated
          </span>
        ) : undefined}
      />

      {noConfig && (
        <div className="px-4 pt-4 sm:px-6">
          <NoConfigBanner missing={noConfig.missing} tab={noConfig.tab} agentName="Social Campaigns" />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Brief form */}
        <div className="max-w-3xl mx-auto space-y-5">
          {state === "idle" && !output && <EmptyState />}

          {/* Objective */}
          <PillSelector
            label="Campaign Objective"
            options={OBJECTIVES}
            selected={[objective]}
            onToggle={toggleObjective}
          />

          {/* Platforms */}
          <PillSelector
            label="Platforms"
            options={PLATFORMS}
            selected={platforms}
            onToggle={togglePlatform}
            multi
          />

          {/* Vertical */}
          <PillSelector
            label="Vertical"
            options={VERTICALS}
            selected={[vertical]}
            onToggle={toggleVertical}
          />

          {/* Autonomy Level */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">
              Autonomy Level
            </label>
            <div className="flex flex-wrap gap-2">
              {AUTONOMY_LEVELS.map((lvl) => (
                <button
                  key={lvl.value}
                  type="button"
                  onClick={() => toggleAutonomy(lvl.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    autonomy === lvl.value
                      ? "bg-teal-500/10 border-teal-500/50 text-teal-600 dark:text-teal-400"
                      : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
                  }`}
                  title={lvl.desc}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">
              Monthly Budget (EUR)
            </label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="3000"
              min={100}
              className="w-full max-w-[200px] rounded-xl border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>

          {/* Audience */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">
              Target Audience
            </label>
            <textarea
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Describe your target audience: demographics, interests, pain points..."
              className="w-full rounded-xl border bg-background px-4 py-3 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              rows={3}
            />
          </div>

          {/* Product */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">
              Product / Service
            </label>
            <textarea
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="Describe what you're promoting: features, value proposition, differentiators..."
              className="w-full rounded-xl border bg-background px-4 py-3 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              rows={3}
            />
          </div>

          {/* Generate button */}
          <button
            onClick={() => void handleGenerate()}
            disabled={state === "loading" || platforms.length === 0}
            className="px-6 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-50 transition-all"
            style={{
              background: "var(--elevay-gradient-btn, linear-gradient(90deg, #17c3b2, #FF7A3D))",
            }}
          >
            {state === "loading" ? "Generating Strategy..." : "Generate Strategy"}
          </button>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {output && (
          <div className="max-w-4xl mx-auto space-y-6 pt-4 border-t">
            {/* Budget allocation */}
            <BudgetViz allocation={output.budgetAllocation} />

            {/* Campaign cards */}
            {output.campaigns.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Campaign Structures</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {output.campaigns.map((c, i) => (
                    <CampaignCard key={i} campaign={c} />
                  ))}
                </div>
              </div>
            )}

            {/* Calendar summary */}
            {output.calendar && output.calendar.posts.length > 0 && (
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <h3 className="text-sm font-semibold">
                  Organic Calendar ({output.calendar.month})
                </h3>
                <div className="text-xs text-muted-foreground">
                  {output.calendar.posts.length} posts planned across{" "}
                  {Object.keys(output.calendar.platformBreakdown).length} platform
                  {Object.keys(output.calendar.platformBreakdown).length > 1 ? "s" : ""}
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(output.calendar.platformBreakdown).map(
                    ([platform, count]) => (
                      <span
                        key={platform}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-muted/70 text-muted-foreground"
                      >
                        {PLATFORM_META[platform as Platform]?.label ?? platform}: {count} posts
                      </span>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
