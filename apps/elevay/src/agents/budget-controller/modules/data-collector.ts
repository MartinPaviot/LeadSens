import type { ChannelMetrics, ChannelStatus, BudgetConfig } from "../core/types"

/**
 * Collect channel metrics from connected platforms.
 * V1: Stub — returns empty metrics. Will integrate Composio batch sync.
 */
export async function collectChannelMetrics(
  config: BudgetConfig,
  _period: string,
): Promise<ChannelMetrics[]> {
  // TODO: Implement Composio batch sync for Google Ads, Meta, GA4, HubSpot
  return config.channels.map((ch) => ({
    channel: ch.channel,
    period: _period,
    spend: 0,
    budgetAllocated: ch.monthlyBudget,
    clicks: 0,
    conversions: 0,
    leads: 0,
    revenue: 0,
    cpl: 0,
    cac: 0,
    roi: 0,
    roas: 0,
    status: "ok" as ChannelStatus,
  }))
}
