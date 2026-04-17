import type {
  PlatformAdapter,
  CampaignMetrics,
  SegmentInfo,
} from "../../core/types"
import { prisma } from "@/lib/prisma"
import { agentWarn } from "@/agents/_shared/agent-logger"

const AGENT = "CRM-27"

async function hubspotFetch<T>(path: string, token: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`https://api.hubapi.com${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      agentWarn(AGENT, "hubspot", `HubSpot API ${res.status} on ${path}`)
      return null
    }
    return await res.json() as T
  } catch (err) {
    agentWarn(AGENT, "hubspot", `HubSpot fetch failed: ${path}`, err instanceof Error ? err.message : err)
    return null
  }
}

export class HubSpotAdapter implements PlatformAdapter {
  constructor(private workspaceId: string) {}

  private async getToken(): Promise<string | null> {
    const integration = await prisma.integration.findFirst({
      where: { workspaceId: this.workspaceId, type: "hubspot", status: "ACTIVE" },
      select: { accessToken: true },
    })
    return integration?.accessToken ?? null
  }

  async scheduleCampaign(params: Parameters<PlatformAdapter["scheduleCampaign"]>[0]) {
    const token = await this.getToken()
    if (!token) {
      agentWarn(AGENT, "hubspot", "No HubSpot integration connected")
      return { campaignId: `hs_stub_${Date.now()}`, scheduledAt: params.scheduledAt }
    }

    // Create a marketing email via HubSpot API
    const draft = params.draft
    const emailData = await hubspotFetch<{ id?: string }>("/marketing/v3/emails", token, {
      method: "POST",
      body: JSON.stringify({
        name: "subject" in draft ? draft.subject : `Campaign ${Date.now()}`,
        subject: "subject" in draft ? draft.subject : "Campaign",
        body: { value: "body" in draft ? draft.body : "" },
        state: "SCHEDULED",
        publishDate: params.scheduledAt,
      }),
    })

    return {
      campaignId: emailData?.id ?? `hs_${Date.now()}`,
      scheduledAt: params.scheduledAt,
    }
  }

  async cancelCampaign(campaignId: string) {
    const token = await this.getToken()
    if (!token) return { success: false }

    const result = await hubspotFetch(`/marketing/v3/emails/${campaignId}`, token, {
      method: "PATCH",
      body: JSON.stringify({ state: "DRAFT" }),
    })
    return { success: result !== null }
  }

  async getCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
    const token = await this.getToken()
    if (!token) return { openRate: 0, clickRate: 0, conversions: 0, revenue: 0, unsubscribes: 0, bounceRate: 0 }

    const stats = await hubspotFetch<{
      counters?: { sent?: number; open?: number; click?: number; bounce?: number; unsubscribed?: number }
    }>(`/marketing/v3/emails/${campaignId}/statistics`, token)

    if (!stats?.counters) return { openRate: 0, clickRate: 0, conversions: 0, revenue: 0, unsubscribes: 0, bounceRate: 0 }

    const sent = stats.counters.sent ?? 1
    return {
      openRate: (stats.counters.open ?? 0) / sent,
      clickRate: (stats.counters.click ?? 0) / sent,
      conversions: stats.counters.click ?? 0,
      revenue: 0,
      unsubscribes: stats.counters.unsubscribed ?? 0,
      bounceRate: (stats.counters.bounce ?? 0) / sent,
    }
  }

  async getSegments(): Promise<SegmentInfo[]> {
    const token = await this.getToken()
    if (!token) return []

    const data = await hubspotFetch<{ lists?: Array<{ listId: number; name: string; listSize: number }> }>(
      "/contacts/v1/lists?count=50",
      token,
    )
    if (!data?.lists) return []

    return data.lists.map((l) => ({
      id: String(l.listId),
      name: l.name,
      count: l.listSize,
    }))
  }

  async getHistoricalOpenRate(days: number): Promise<number> {
    const token = await this.getToken()
    if (!token) return 0.20

    // Fetch recent email stats and average open rates
    const data = await hubspotFetch<{
      objects?: Array<{ counters?: { sent?: number; open?: number } }>
    }>(`/marketing/v3/emails?limit=10&state=SENT`, token)

    if (!data?.objects?.length) return 0.20

    let totalSent = 0, totalOpens = 0
    for (const email of data.objects) {
      totalSent += email.counters?.sent ?? 0
      totalOpens += email.counters?.open ?? 0
    }
    return totalSent > 0 ? totalOpens / totalSent : 0.20
  }
}
