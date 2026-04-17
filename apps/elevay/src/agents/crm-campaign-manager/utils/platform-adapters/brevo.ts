import type {
  PlatformAdapter,
  CampaignMetrics,
  SegmentInfo,
} from "../../core/types"
import { prisma } from "@/lib/prisma"
import { agentWarn } from "@/agents/_shared/agent-logger"

const AGENT = "CRM-27"

async function brevoFetch<T>(path: string, apiKey: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`https://api.brevo.com/v3${path}`, {
      ...options,
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        ...options?.headers,
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      agentWarn(AGENT, "brevo", `Brevo API ${res.status} on ${path}`)
      return null
    }
    return await res.json() as T
  } catch (err) {
    agentWarn(AGENT, "brevo", `Brevo fetch failed: ${path}`, err instanceof Error ? err.message : err)
    return null
  }
}

export class BrevoAdapter implements PlatformAdapter {
  constructor(private workspaceId: string) {}

  private async getApiKey(): Promise<string | null> {
    const integration = await prisma.integration.findFirst({
      where: { workspaceId: this.workspaceId, type: "brevo", status: "ACTIVE" },
      select: { apiKey: true },
    })
    return integration?.apiKey ?? null
  }

  async scheduleCampaign(params: Parameters<PlatformAdapter["scheduleCampaign"]>[0]) {
    const apiKey = await this.getApiKey()
    if (!apiKey) {
      agentWarn(AGENT, "brevo", "No Brevo integration connected")
      return { campaignId: `bv_stub_${Date.now()}`, scheduledAt: params.scheduledAt }
    }

    const draft = params.draft
    const data = await brevoFetch<{ id?: number }>("/emailCampaigns", apiKey, {
      method: "POST",
      body: JSON.stringify({
        name: "subject" in draft ? draft.subject : `Campaign ${Date.now()}`,
        subject: "subject" in draft ? draft.subject : "Campaign",
        htmlContent: "body" in draft ? draft.body : "",
        sender: { name: "Elevay", email: "noreply@elevay.io" },
        recipients: { listIds: params.segment ? [Number(params.segment)] : [] },
        scheduledAt: params.scheduledAt,
      }),
    })

    return {
      campaignId: data?.id ? String(data.id) : `bv_${Date.now()}`,
      scheduledAt: params.scheduledAt,
    }
  }

  async cancelCampaign(campaignId: string) {
    const apiKey = await this.getApiKey()
    if (!apiKey) return { success: false }

    const result = await brevoFetch(`/emailCampaigns/${campaignId}/status`, apiKey, {
      method: "PUT",
      body: JSON.stringify({ status: "suspended" }),
    })
    return { success: result !== null }
  }

  async getCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
    const apiKey = await this.getApiKey()
    if (!apiKey) return { openRate: 0, clickRate: 0, conversions: 0, revenue: 0, unsubscribes: 0, bounceRate: 0 }

    const stats = await brevoFetch<{
      statistics?: { globalStats?: {
        uniqueOpens?: number; uniqueClicks?: number;
        hardBounces?: number; softBounces?: number;
        unsubscriptions?: number; sent?: number
      } }
    }>(`/emailCampaigns/${campaignId}`, apiKey)

    const g = stats?.statistics?.globalStats
    if (!g) return { openRate: 0, clickRate: 0, conversions: 0, revenue: 0, unsubscribes: 0, bounceRate: 0 }

    const sent = g.sent ?? 1
    return {
      openRate: (g.uniqueOpens ?? 0) / sent,
      clickRate: (g.uniqueClicks ?? 0) / sent,
      conversions: g.uniqueClicks ?? 0,
      revenue: 0,
      unsubscribes: g.unsubscriptions ?? 0,
      bounceRate: ((g.hardBounces ?? 0) + (g.softBounces ?? 0)) / sent,
    }
  }

  async getSegments(): Promise<SegmentInfo[]> {
    const apiKey = await this.getApiKey()
    if (!apiKey) return []

    const data = await brevoFetch<{ lists?: Array<{ id: number; name: string; totalSubscribers: number }> }>(
      "/contacts/lists?limit=50",
      apiKey,
    )
    if (!data?.lists) return []

    return data.lists.map((l) => ({
      id: String(l.id),
      name: l.name,
      count: l.totalSubscribers,
    }))
  }

  async getHistoricalOpenRate(_days: number): Promise<number> {
    const apiKey = await this.getApiKey()
    if (!apiKey) return 0.20

    const data = await brevoFetch<{
      campaigns?: Array<{ statistics?: { globalStats?: { uniqueOpens?: number; sent?: number } } }>
    }>("/emailCampaigns?type=classic&status=sent&limit=10&sort=desc", apiKey)

    if (!data?.campaigns?.length) return 0.20

    let totalSent = 0, totalOpens = 0
    for (const c of data.campaigns) {
      totalSent += c.statistics?.globalStats?.sent ?? 0
      totalOpens += c.statistics?.globalStats?.uniqueOpens ?? 0
    }
    return totalSent > 0 ? totalOpens / totalSent : 0.20
  }
}
