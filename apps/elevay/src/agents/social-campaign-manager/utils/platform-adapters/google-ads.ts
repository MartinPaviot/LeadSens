import type { CampaignStructure } from "../../core/types"

/**
 * Google Ads adapter stub.
 *
 * TODO: Integrate with Google Ads API for:
 * - Campaign creation (Search, Display, Shopping, Performance Max)
 * - Budget management
 * - Keyword bidding
 * - Conversion tracking
 * - Reporting
 */

export interface GoogleAdsConfig {
  customerId: string
  refreshToken: string
}

export async function createGoogleCampaign(
  _campaign: CampaignStructure,
  _config: GoogleAdsConfig,
): Promise<{ campaignId: string }> {
  await Promise.resolve()
  return { campaignId: `google-stub-${Date.now()}` }
}

export async function pauseGoogleCampaign(
  _campaignId: string,
  _config: GoogleAdsConfig,
): Promise<{ success: boolean }> {
  await Promise.resolve()
  return { success: true }
}

export async function getGoogleMetrics(
  _campaignId: string,
  _config: GoogleAdsConfig,
): Promise<{
  spend: number
  impressions: number
  clicks: number
  conversions: number
}> {
  await Promise.resolve()
  return { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
}
