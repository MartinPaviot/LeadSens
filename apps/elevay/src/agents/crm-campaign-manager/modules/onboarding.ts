import type { CRMConfig, CRMPlatform } from "../core/types"
import { getCRMAdapter } from "../utils/platform-adapters"
import { DEFAULT_MAX_SENDS_PER_WEEK, TIMING_DEFAULTS } from "../core/constants"

/**
 * Initialize CRM configuration by importing metadata from the connected platform.
 */
export async function initializeCRMConfig(
  platform: CRMPlatform,
): Promise<CRMConfig> {
  const adapter = getCRMAdapter(platform)

  const [segments, historicalOpenRate] = await Promise.all([
    adapter.getSegments(),
    adapter.getHistoricalOpenRate(90),
  ])

  return {
    platform,
    maxSendsPerContactPerWeek: DEFAULT_MAX_SENDS_PER_WEEK,
    defaultResend: true,
    segments,
    historicalOpenRate,
    bestTimings: TIMING_DEFAULTS.bestDays.map((day, i) => ({
      day,
      hour: TIMING_DEFAULTS.bestHours[i] ?? "10:00",
      openRate: historicalOpenRate,
    })),
  }
}
