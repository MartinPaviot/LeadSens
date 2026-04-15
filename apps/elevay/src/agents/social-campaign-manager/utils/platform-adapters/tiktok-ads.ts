import type { CampaignStructure } from "../../core/types"

/**
 * TikTok Ads adapter stub.
 *
 * TODO: Integrate with TikTok Marketing API for:
 * - Campaign creation (In-Feed, TopView, Branded Hashtag, Spark Ads)
 * - Audience targeting (demographics, interests, behavior, custom)
 * - Pixel event tracking
 * - Creative management
 * - Reporting
 */

export interface TikTokAdsConfig {
  accessToken: string
  advertiserId: string
  pixelId?: string
}

export async function createTikTokCampaign(
  _campaign: CampaignStructure,
  _config: TikTokAdsConfig,
): Promise<{ campaignId: string }> {
  await Promise.resolve()
  return { campaignId: `tiktok-stub-${Date.now()}` }
}

export async function pauseTikTokCampaign(
  _campaignId: string,
  _config: TikTokAdsConfig,
): Promise<{ success: boolean }> {
  await Promise.resolve()
  return { success: true }
}

export async function getTikTokMetrics(
  _campaignId: string,
  _config: TikTokAdsConfig,
): Promise<{
  spend: number
  impressions: number
  clicks: number
  conversions: number
}> {
  await Promise.resolve()
  return { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
}
