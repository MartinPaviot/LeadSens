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
  workspaceId: string
}): Promise<ScheduleResult> {
  const adapter = getCRMAdapter(params.platform, params.workspaceId)
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
  workspaceId: string
}): Promise<ScheduleResult> {
  const adapter = getSMSAdapter(params.platform, params.workspaceId)
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
  workspaceId: string,
): Promise<boolean> {
  const adapter =
    platform === "twilio"
      ? getSMSAdapter(platform, workspaceId)
      : getCRMAdapter(platform, workspaceId)
  const result = await adapter.cancelCampaign(campaignId)
  return result.success
}
