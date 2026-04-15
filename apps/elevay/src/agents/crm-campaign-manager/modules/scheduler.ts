import type {
  EmailDraft,
  SMSDraft,
  ABConfig,
  CRMPlatform,
  SMSPlatform,
} from "../core/types"
import { getCRMAdapter, getSMSAdapter } from "../utils/platform-adapters"

export interface ScheduleResult {
  campaignId: string
  scheduledAt: string
  platform: string
  segment: string
}

export async function scheduleCampaign(params: {
  draft: EmailDraft
  segment: string
  scheduledAt: string
  platform: CRMPlatform
  abConfig?: ABConfig
}): Promise<ScheduleResult> {
  const adapter = getCRMAdapter(params.platform)
  const result = await adapter.scheduleCampaign({
    draft: params.draft,
    segment: params.segment,
    scheduledAt: params.scheduledAt,
    abConfig: params.abConfig,
  })

  return {
    ...result,
    platform: params.platform,
    segment: params.segment,
  }
}

export async function scheduleSMS(params: {
  draft: SMSDraft
  segment: string
  scheduledAt: string
  platform: SMSPlatform
}): Promise<ScheduleResult> {
  const adapter = getSMSAdapter(params.platform)
  const result = await adapter.scheduleCampaign({
    draft: params.draft,
    segment: params.segment,
    scheduledAt: params.scheduledAt,
  })

  return {
    ...result,
    platform: params.platform,
    segment: params.segment,
  }
}

export async function cancelScheduledCampaign(
  campaignId: string,
  platform: CRMPlatform | SMSPlatform,
): Promise<boolean> {
  const adapter =
    platform === "twilio"
      ? getSMSAdapter(platform)
      : getCRMAdapter(platform)
  const result = await adapter.cancelCampaign(campaignId)
  return result.success
}
