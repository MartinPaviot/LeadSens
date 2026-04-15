import type { CampaignStructure } from "../../core/types"

/**
 * LinkedIn Ads adapter stub.
 *
 * TODO: Integrate with LinkedIn Marketing API for:
 * - Campaign creation (Sponsored Content, Message Ads, Text Ads)
 * - Audience targeting (job title, company, industry, seniority)
 * - Lead gen form management
 * - Insight Tag verification
 * - Reporting
 */

export interface LinkedInAdsConfig {
  accessToken: string
  adAccountId: string
}

export async function createLinkedInCampaign(
  _campaign: CampaignStructure,
  _config: LinkedInAdsConfig,
): Promise<{ campaignId: string }> {
  await Promise.resolve()
  return { campaignId: `linkedin-stub-${Date.now()}` }
}

export async function pauseLinkedInCampaign(
  _campaignId: string,
  _config: LinkedInAdsConfig,
): Promise<{ success: boolean }> {
  await Promise.resolve()
  return { success: true }
}

export async function getLinkedInMetrics(
  _campaignId: string,
  _config: LinkedInAdsConfig,
): Promise<{
  spend: number
  impressions: number
  clicks: number
  conversions: number
}> {
  await Promise.resolve()
  return { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
}
