import type {
  CampaignBrief,
  StrategyOutput,
} from "./core/types"
import { SMC_AGENT_CODE, SMC_VERSION } from "./core/constants"
import { runDiagnostic } from "./modules/diagnostic"
import { generateCalendar } from "./modules/organic-planner"
import { allocateBudget } from "./modules/budget-allocator"

export interface SMCRunResult {
  agentCode: typeof SMC_AGENT_CODE
  version: typeof SMC_VERSION
  output: StrategyOutput
  durationMs: number
}

/**
 * Main orchestrator for the Social Media Campaign Manager agent.
 *
 * Flow: Brief → Diagnostic (strategy + campaigns) → Budget Allocation → Organic Calendar → Output
 */
export async function runSMC(
  brief: CampaignBrief,
  language: string = "en",
): Promise<SMCRunResult> {
  const startedAt = Date.now()

  // Step 1: Run diagnostic to generate strategy + campaign structures
  const diagnostic = await runDiagnostic(brief, language)

  // Step 2: Compute deterministic budget allocation (merge with LLM suggestion)
  const deterministicAllocation = allocateBudget(brief)

  // Use LLM allocation if it returned valid data, otherwise use deterministic
  const budgetAllocation =
    diagnostic.budgetAllocation.byPlatform.length > 0
      ? diagnostic.budgetAllocation
      : deterministicAllocation

  // Step 3: Generate organic calendar for current month
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const organicPlatforms = brief.platforms.filter((p) => p !== "google")
  let calendar = null
  if (organicPlatforms.length > 0) {
    calendar = await generateCalendar(brief, currentMonth, language)
  }

  const output: StrategyOutput = {
    brief,
    budgetAllocation,
    campaigns: diagnostic.campaigns,
    calendar,
    generatedAt: new Date().toISOString(),
  }

  return {
    agentCode: SMC_AGENT_CODE,
    version: SMC_VERSION,
    output,
    durationMs: Date.now() - startedAt,
  }
}
