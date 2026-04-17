import type { ChannelMetrics, ChannelStatus, BudgetConfig } from "../core/types"
import { prisma } from "@/lib/prisma"
import { agentWarn } from "@/agents/_shared/agent-logger"

const AGENT = "BDG-32"

interface AdPlatformMetrics {
  spend: number
  clicks: number
  conversions: number
  revenue: number
}

/**
 * Fetch metrics from Google Ads API via stored integration credentials.
 */
async function fetchGoogleAdsMetrics(workspaceId: string): Promise<AdPlatformMetrics | null> {
  const integration = await prisma.integration.findFirst({
    where: { workspaceId, type: "google-ads", status: "ACTIVE" },
    select: { accessToken: true, refreshToken: true, metadata: true },
  })
  if (!integration?.accessToken) return null

  try {
    // Google Ads API — customer resource metrics
    const customerId = (integration.metadata as Record<string, string> | null)?.customerId
    if (!customerId) return null

    const res = await fetch(
      `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
          "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `SELECT metrics.cost_micros, metrics.clicks, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date DURING LAST_30_DAYS`,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    )
    if (!res.ok) {
      agentWarn(AGENT, "data-collector", `Google Ads API returned ${res.status}`)
      return null
    }
    const data = await res.json() as Array<{ results?: Array<{ metrics?: Record<string, string> }> }>
    const results = data[0]?.results ?? []
    let spend = 0, clicks = 0, conversions = 0, revenue = 0
    for (const row of results) {
      spend += Number(row.metrics?.cost_micros ?? 0) / 1_000_000
      clicks += Number(row.metrics?.clicks ?? 0)
      conversions += Number(row.metrics?.conversions ?? 0)
      revenue += Number(row.metrics?.conversions_value ?? 0)
    }
    return { spend, clicks, conversions, revenue }
  } catch (err) {
    agentWarn(AGENT, "data-collector", "Google Ads fetch failed", err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Fetch metrics from Meta Ads API via stored integration credentials.
 */
async function fetchMetaAdsMetrics(workspaceId: string): Promise<AdPlatformMetrics | null> {
  const integration = await prisma.integration.findFirst({
    where: { workspaceId, type: "meta-ads", status: "ACTIVE" },
    select: { accessToken: true, metadata: true },
  })
  if (!integration?.accessToken) return null

  try {
    const adAccountId = (integration.metadata as Record<string, string> | null)?.adAccountId
    if (!adAccountId) return null

    const params = new URLSearchParams({
      fields: "spend,clicks,actions",
      date_preset: "last_30d",
      access_token: integration.accessToken,
    })
    const res = await fetch(
      `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?${params}`,
      { signal: AbortSignal.timeout(15_000) },
    )
    if (!res.ok) {
      agentWarn(AGENT, "data-collector", `Meta Ads API returned ${res.status}`)
      return null
    }
    const data = await res.json() as { data?: Array<{ spend?: string; clicks?: string; actions?: Array<{ action_type: string; value: string }> }> }
    const row = data.data?.[0]
    if (!row) return null

    const conversions = row.actions?.find((a) => a.action_type === "offsite_conversion.fb_pixel_purchase")
    return {
      spend: Number(row.spend ?? 0),
      clicks: Number(row.clicks ?? 0),
      conversions: Number(conversions?.value ?? 0),
      revenue: 0, // Meta doesn't return revenue directly in insights
    }
  } catch (err) {
    agentWarn(AGENT, "data-collector", "Meta Ads fetch failed", err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Derive computed metrics (CPL, CAC, ROI, ROAS) and status from raw numbers.
 */
function deriveMetrics(
  raw: AdPlatformMetrics,
  budgetAllocated: number,
  period: string,
): Omit<ChannelMetrics, "channel"> {
  const cpl = raw.conversions > 0 ? raw.spend / raw.conversions : 0
  const cac = raw.conversions > 0 ? raw.spend / raw.conversions : 0
  const roi = raw.spend > 0 ? (raw.revenue - raw.spend) / raw.spend : 0
  const roas = raw.spend > 0 ? raw.revenue / raw.spend : 0

  const spendRatio = budgetAllocated > 0 ? raw.spend / budgetAllocated : 0
  let status: ChannelStatus = "ok"
  if (spendRatio > 1.15) status = "critical"
  else if (spendRatio > 1.0) status = "attention"
  else if (roi > 2) status = "optimal"

  return {
    period,
    spend: raw.spend,
    budgetAllocated,
    clicks: raw.clicks,
    conversions: raw.conversions,
    leads: raw.conversions, // V1: leads ≈ conversions
    revenue: raw.revenue,
    cpl: Math.round(cpl * 100) / 100,
    cac: Math.round(cac * 100) / 100,
    roi: Math.round(roi * 100) / 100,
    roas: Math.round(roas * 100) / 100,
    status,
  }
}

/**
 * Collect channel metrics from connected platforms.
 * Loads integration credentials from DB and calls real APIs.
 * Falls back to zeros for channels without connected integrations.
 */
export async function collectChannelMetrics(
  config: BudgetConfig,
  period: string,
  workspaceId?: string,
): Promise<ChannelMetrics[]> {
  // Without workspace context, return empty metrics
  if (!workspaceId) {
    return config.channels.map((ch) => ({
      channel: ch.channel,
      period,
      spend: 0, budgetAllocated: ch.monthlyBudget,
      clicks: 0, conversions: 0, leads: 0, revenue: 0,
      cpl: 0, cac: 0, roi: 0, roas: 0,
      status: "ok" as ChannelStatus,
    }))
  }

  // Fetch real metrics from connected platforms in parallel
  const [googleAds, metaAds] = await Promise.all([
    fetchGoogleAdsMetrics(workspaceId),
    fetchMetaAdsMetrics(workspaceId),
  ])

  const platformData: Record<string, AdPlatformMetrics | null> = {
    "google-ads": googleAds,
    "meta-ads": metaAds,
  }

  return config.channels.map((ch) => {
    const raw = platformData[ch.channel]
    if (raw) {
      return { channel: ch.channel, ...deriveMetrics(raw, ch.monthlyBudget, period) }
    }
    // No integration connected — return zeros
    return {
      channel: ch.channel,
      period,
      spend: 0, budgetAllocated: ch.monthlyBudget,
      clicks: 0, conversions: 0, leads: 0, revenue: 0,
      cpl: 0, cac: 0, roi: 0, roas: 0,
      status: "ok" as ChannelStatus,
    }
  })
}
