import type {
  CampaignBrief,
  BudgetAllocation,
  BudgetSplit,
  PlatformBudget,
  PlatformMetrics,
} from "../core/types"
import { BUDGET_DEFAULTS, PLATFORM_META, VERTICAL_CONFIGS } from "../core/constants"

// ── Budget Allocation ──────────────────────────────────

/**
 * Allocate budget across split categories and platforms.
 * Adapts defaults based on vertical and objective.
 */
export function allocateBudget(brief: CampaignBrief): BudgetAllocation {
  const split = computeSplit(brief)
  const byPlatform = distributePlatformBudget(brief, split)

  return {
    split,
    byPlatform,
    totalMonthly: brief.monthlyBudget,
  }
}

function computeSplit(brief: CampaignBrief): BudgetSplit {
  // Start from defaults
  const split = { ...BUDGET_DEFAULTS }

  // Adjust based on objective
  switch (brief.objective) {
    case "awareness":
      split.cold = 55
      split.retargeting = 15
      split.scaling = 20
      split.tests = 10
      break
    case "conversions":
    case "leads":
      split.cold = 35
      split.retargeting = 30
      split.scaling = 25
      split.tests = 10
      break
    case "engagement":
      split.cold = 45
      split.retargeting = 20
      split.scaling = 25
      split.tests = 10
      break
    default:
      // Use defaults
      break
  }

  // Cap test budget per constraints
  if (brief.budgetConstraints.testBudgetCap < split.tests) {
    const excess = split.tests - brief.budgetConstraints.testBudgetCap
    split.tests = brief.budgetConstraints.testBudgetCap
    split.scaling += excess
  }

  return split
}

function distributePlatformBudget(
  brief: CampaignBrief,
  _split: BudgetSplit,
): PlatformBudget[] {
  const platforms = brief.platforms
  const total = brief.monthlyBudget

  // Weight platforms based on vertical fit
  const weights = platforms.map((p) => {
    const meta = PLATFORM_META[p]
    const verticalCfg = VERTICAL_CONFIGS[brief.vertical]
    let weight = 1

    // Boost platforms that match the objective
    if (meta.bestFor.includes(brief.objective)) {
      weight += 0.5
    }

    // B2B vertical heavily favors LinkedIn and Google
    if (brief.vertical === "b2b") {
      if (p === "linkedin") weight += 1
      if (p === "google") weight += 0.5
    }

    // E-commerce favors Meta and Google
    if (brief.vertical === "ecommerce") {
      if (p === "meta") weight += 0.8
      if (p === "google") weight += 0.8
    }

    // SaaS favors Google and LinkedIn
    if (brief.vertical === "saas") {
      if (p === "google") weight += 0.5
      if (p === "linkedin") weight += 0.5
    }

    // Personal branding favors social platforms
    if (brief.vertical === "personal-branding") {
      if (p === "linkedin" || p === "x" || p === "tiktok") weight += 0.5
    }

    // Suppress unused reference for linting
    void verticalCfg

    return { platform: p, weight }
  })

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)

  return weights.map(({ platform, weight }) => {
    const percentage = Math.round((weight / totalWeight) * 100)
    const amount = Math.round((weight / totalWeight) * total)

    // Ensure minimum daily budget is met
    const minMonthly = PLATFORM_META[platform].minDailyBudget * 30
    const finalAmount = Math.max(amount, minMonthly)

    return {
      platform,
      amount: finalAmount,
      percentage,
    }
  })
}

// ── Weekly Rebalance ───────────────────────────────────

/**
 * Rebalance budget weekly based on actual performance.
 * Shifts budget from underperforming to outperforming platforms.
 */
export function rebalanceWeekly(
  currentAllocation: BudgetAllocation,
  metrics: PlatformMetrics[],
): BudgetAllocation {
  if (metrics.length === 0) return currentAllocation

  // Calculate efficiency score per platform (ROAS-weighted)
  const scores = new Map<string, number>()
  for (const m of metrics) {
    const efficiency = m.roas > 0 ? m.roas : 0.1
    scores.set(m.platform, efficiency)
  }

  const totalScore = Array.from(scores.values()).reduce((a, b) => a + b, 0)
  if (totalScore === 0) return currentAllocation

  const rebalanced: PlatformBudget[] = currentAllocation.byPlatform.map((pb) => {
    const score = scores.get(pb.platform) ?? 1
    const newPercentage = Math.round((score / totalScore) * 100)
    const newAmount = Math.round(
      (score / totalScore) * currentAllocation.totalMonthly,
    )

    // Limit swing to max 20% change per week
    const maxSwing = pb.amount * 0.2
    const clampedAmount = Math.max(
      pb.amount - maxSwing,
      Math.min(pb.amount + maxSwing, newAmount),
    )

    return {
      platform: pb.platform,
      amount: Math.round(clampedAmount),
      percentage: newPercentage,
    }
  })

  return {
    ...currentAllocation,
    byPlatform: rebalanced,
  }
}
