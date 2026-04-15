import type {
  CRMCampaignBrief,
  CRMConfig,
  EmailDraft,
  SMSDraft,
  CampaignReport,
} from "./core/types"
import { CRM_AGENT_CODE, CRM_VERSION } from "./core/constants"
import { generateEmailDraft } from "./modules/content-generator"
import { generateSMSDraft } from "./modules/sms-generator"
import { calculateOptimalTiming } from "./modules/timing-optimizer"
import type { TimingProposal } from "./modules/timing-optimizer"

export interface CRMRunResult {
  agentCode: typeof CRM_AGENT_CODE
  version: typeof CRM_VERSION
  emailDraft?: EmailDraft
  smsDraft?: SMSDraft
  timingProposals: TimingProposal[]
  durationMs: number
}

/**
 * Main orchestrator for the CRM Campaign Manager agent.
 *
 * Flow: Brief → Timing → Draft Generation → (A/B if enabled) → Output
 * Scheduling, tracking, reporting, and resending are handled post-validation.
 */
export async function runCRM(
  brief: CRMCampaignBrief,
  config: CRMConfig,
): Promise<CRMRunResult> {
  const startedAt = Date.now()

  // 1. Calculate optimal timing
  const timingProposals = calculateOptimalTiming(
    config,
    brief.preferredDate,
    brief.preferredTime,
  )

  // 2. Generate content based on channel
  let emailDraft: EmailDraft | undefined
  let smsDraft: SMSDraft | undefined

  if (brief.channel === "email" || brief.channel === "both") {
    emailDraft = await generateEmailDraft({
      tone: brief.tone,
      objective: brief.objective,
      segment: brief.segment,
      offerUrl: brief.offerUrl,
      promoCode: brief.promoCode,
      abConfig: brief.abConfig,
    })
  }

  if (brief.channel === "sms" || brief.channel === "both") {
    smsDraft = await generateSMSDraft({
      tone: brief.tone,
      objective: brief.objective,
      offerUrl: brief.offerUrl,
      promoCode: brief.promoCode,
      abEnabled: brief.abConfig?.enabled,
    })
  }

  return {
    agentCode: CRM_AGENT_CODE,
    version: CRM_VERSION,
    emailDraft,
    smsDraft,
    timingProposals,
    durationMs: Date.now() - startedAt,
  }
}
