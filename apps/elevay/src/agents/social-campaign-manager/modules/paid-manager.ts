import type { CampaignStructure, Platform } from "../core/types"
import { prisma } from "@/lib/prisma"
import { agentWarn } from "@/agents/_shared/agent-logger"

const AGENT = "SMC-19"

export interface CampaignActionResult {
  success: boolean
  campaignId?: string
  platform: Platform
  action: "create" | "pause" | "adjust"
  error?: string
}

export interface CampaignAdjustment {
  campaignId: string
  platform: Platform
  budgetChange?: number
  audienceChange?: string
  creativeSwap?: boolean
}

const PLATFORM_INTEGRATION_MAP: Record<string, string> = {
  google: "google-ads",
  meta: "meta-ads",
  linkedin: "linkedin-ads",
  x: "x-ads",
  tiktok: "tiktok-ads",
}

async function getIntegrationToken(workspaceId: string, platform: Platform): Promise<string | null> {
  const type = PLATFORM_INTEGRATION_MAP[platform]
  if (!type) return null
  const integration = await prisma.integration.findFirst({
    where: { workspaceId, type, status: "ACTIVE" },
    select: { accessToken: true },
  })
  return integration?.accessToken ?? null
}

/**
 * Create a campaign on the target ad platform.
 * Loads integration credentials and calls the platform API.
 */
export async function createCampaign(
  campaign: CampaignStructure,
  workspaceId?: string,
): Promise<CampaignActionResult> {
  if (!workspaceId) {
    return { success: false, platform: campaign.platform, action: "create", error: "No workspace context" }
  }

  const token = await getIntegrationToken(workspaceId, campaign.platform)
  if (!token) {
    agentWarn(AGENT, "paid-manager", `No ${campaign.platform} ads integration connected`)
    return {
      success: false,
      platform: campaign.platform,
      action: "create",
      error: `Connect ${PLATFORM_INTEGRATION_MAP[campaign.platform]} in Settings to create campaigns`,
    }
  }

  // Platform-specific campaign creation
  switch (campaign.platform) {
    case "meta": {
      try {
        // Meta Marketing API — create campaign
        const res = await fetch(`https://graph.facebook.com/v21.0/act_${campaign.platform}/campaigns`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: campaign.name,
            objective: campaign.type.toUpperCase(),
            status: "PAUSED", // Create paused, user activates
            special_ad_categories: [],
            access_token: token,
          }),
          signal: AbortSignal.timeout(15_000),
        })
        if (!res.ok) {
          const err = await res.text()
          return { success: false, platform: campaign.platform, action: "create", error: `Meta API: ${err.slice(0, 200)}` }
        }
        const data = await res.json() as { id?: string }
        return { success: true, campaignId: data.id, platform: campaign.platform, action: "create" }
      } catch (err) {
        return { success: false, platform: campaign.platform, action: "create", error: err instanceof Error ? err.message : "Failed" }
      }
    }
    default:
      agentWarn(AGENT, "paid-manager", `${campaign.platform} campaign creation not yet implemented`)
      return {
        success: false,
        platform: campaign.platform,
        action: "create",
        error: `${campaign.platform} campaign creation coming soon`,
      }
  }
}

/**
 * Pause an active campaign.
 */
export async function pauseCampaign(
  campaignId: string,
  platform: Platform,
  reason: string,
  workspaceId?: string,
): Promise<CampaignActionResult> {
  if (!workspaceId) {
    return { success: false, campaignId, platform, action: "pause", error: "No workspace context" }
  }

  const token = await getIntegrationToken(workspaceId, platform)
  if (!token) {
    return { success: false, campaignId, platform, action: "pause", error: `No ${platform} ads integration` }
  }

  agentWarn(AGENT, "paid-manager", `Pausing campaign ${campaignId} on ${platform}: ${reason}`)

  switch (platform) {
    case "meta": {
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${campaignId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "PAUSED", access_token: token }),
          signal: AbortSignal.timeout(15_000),
        })
        return { success: res.ok, campaignId, platform, action: "pause" }
      } catch {
        return { success: false, campaignId, platform, action: "pause", error: "API call failed" }
      }
    }
    default:
      return { success: false, campaignId, platform, action: "pause", error: `${platform} pause not yet implemented` }
  }
}

/**
 * Adjust campaign settings (budget, audience, creatives).
 */
export async function adjustCampaign(
  adjustment: CampaignAdjustment,
  workspaceId?: string,
): Promise<CampaignActionResult> {
  if (!workspaceId) {
    return { success: false, campaignId: adjustment.campaignId, platform: adjustment.platform, action: "adjust", error: "No workspace context" }
  }

  const token = await getIntegrationToken(workspaceId, adjustment.platform)
  if (!token) {
    return { success: false, campaignId: adjustment.campaignId, platform: adjustment.platform, action: "adjust", error: `No ${adjustment.platform} ads integration` }
  }

  agentWarn(AGENT, "paid-manager", `Adjusting campaign ${adjustment.campaignId}: budget=${adjustment.budgetChange}`)

  // V1: Only Meta budget adjustment is implemented
  if (adjustment.platform === "meta" && adjustment.budgetChange) {
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${adjustment.campaignId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daily_budget: Math.round(adjustment.budgetChange * 100), // Meta uses cents
          access_token: token,
        }),
        signal: AbortSignal.timeout(15_000),
      })
      return { success: res.ok, campaignId: adjustment.campaignId, platform: adjustment.platform, action: "adjust" }
    } catch {
      return { success: false, campaignId: adjustment.campaignId, platform: adjustment.platform, action: "adjust", error: "API call failed" }
    }
  }

  return { success: false, campaignId: adjustment.campaignId, platform: adjustment.platform, action: "adjust", error: `${adjustment.platform} adjustments coming soon` }
}
