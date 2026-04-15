import type { CampaignStructure } from "../../core/types"

/**
 * Meta Ads adapter stub.
 *
 * TODO: Integrate with Meta Marketing API for:
 * - Campaign creation (Awareness, Traffic, Engagement, Leads, Sales)
 * - Ad set management (audiences, placements, budgets)
 * - Ad creation (image, video, carousel, collection)
 * - Pixel/CAPI event tracking
 * - Reporting & insights
 */

export interface MetaAdsConfig {
  accessToken: string
  adAccountId: string
  pixelId?: string
}

export async function createMetaCampaign(
  _campaign: CampaignStructure,
  _config: MetaAdsConfig,
): Promise<{ campaignId: string }> {
  await Promise.resolve()
  return { campaignId: `meta-stub-${Date.now()}` }
}

export async function pauseMetaCampaign(
  _campaignId: string,
  _config: MetaAdsConfig,
): Promise<{ success: boolean }> {
  await Promise.resolve()
  return { success: true }
}

export async function getMetaMetrics(
  _campaignId: string,
  _config: MetaAdsConfig,
): Promise<{
  spend: number
  impressions: number
  clicks: number
  conversions: number
}> {
  await Promise.resolve()
  return { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
}
