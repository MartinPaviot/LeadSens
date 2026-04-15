import type { CampaignMetrics, CRMPlatform } from "../core/types"
import { getCRMAdapter } from "../utils/platform-adapters"

/**
 * Pull campaign metrics from the CRM platform.
 */
export async function getCampaignMetrics(
  campaignId: string,
  platform: CRMPlatform,
): Promise<CampaignMetrics> {
  const adapter = getCRMAdapter(platform)
  return adapter.getCampaignMetrics(campaignId)
}
