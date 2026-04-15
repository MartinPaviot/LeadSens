"use client"

import { useState, useCallback } from "react"
import type {
  BudgetDashboardData,
  HealthScore,
  ChannelMetrics,
  Alert,
} from "@/agents/budget-controller/core/types"
import { ALERT_LEVELS } from "@/agents/budget-controller/core/constants"
import { toast } from "sonner"

type DashboardState = "idle" | "loading" | "ready" | "error"

function HealthScoreRing({ score }: { score: HealthScore }) {
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score.total / 100) * circumference
  const color = ALERT_LEVELS[score.level].color

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
          <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color }}>{score.total}</span>
          <span className="text-[10px] text-muted-foreground uppercase">{score.level}</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium">Budget Health</p>
        <p className="text-xs text-muted-foreground">
          Trend: {score.trend === "improving" ? "↑" : score.trend === "declining" ? "↓" : "→"} {score.trend}
        </p>
      </div>
    </div>
  )
}

function ChannelCard({ metrics }: { metrics: ChannelMetrics }) {
  const spendPercent = metrics.budgetAllocated > 0 ? (metrics.spend / metrics.budgetAllocated) * 100 : 0
  const statusColors: Record<string, string> = {
    critical: "bg-red-500",
    attention: "bg-orange-400",
    ok: "bg-teal-500",
    optimal: "bg-blue-500",
  }

  return (
    <div className="rounded-xl border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{metrics.channel}</span>
        <span className={`w-2.5 h-2.5 rounded-full ${statusColors[metrics.status] ?? "bg-gray-300"}`} />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Budget</span>
          <span>{spendPercent.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full ${spendPercent > 100 ? "bg-red-500" : "bg-teal-500"}`} style={{ width: `${Math.min(spendPercent, 100)}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-muted-foreground">ROI</span> <span className="font-medium">{metrics.roi.toFixed(2)}x</span></div>
        <div><span className="text-muted-foreground">CAC</span> <span className="font-medium">€{metrics.cac.toFixed(0)}</span></div>
      </div>
    </div>
  )
}

function AlertBanner({ alerts }: { alerts: Alert[] }) {
  const critical = alerts.filter((a) => a.level === "critical")
  if (critical.length === 0) return null

  return (
    <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-1">
      <p className="text-sm font-semibold text-red-700">{critical.length} Critical Alert{critical.length > 1 ? "s" : ""}</p>
      {critical.slice(0, 3).map((a) => (
        <p key={a.id} className="text-xs text-red-600">{a.message}</p>
      ))}
    </div>
  )
}

export function BudgetDashboard() {
  const [state, setState] = useState<DashboardState>("idle")
  const [data, setData] = useState<BudgetDashboardData | null>(null)

  const handleRefresh = useCallback(async () => {
    setState("loading")
    try {
      const response = await fetch("/api/agents/budget-controller/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error((err as Record<string, string>).error ?? "Failed")
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No stream")
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(line.slice(6)) as Record<string, unknown>
              if ("dashboard" in parsed) {
                setData(parsed.dashboard as BudgetDashboardData)
                setState("ready")
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
      setState("error")
    }
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0" style={{ height: "48px", minHeight: "48px" }}>
        <h1 className="text-lg font-semibold">Budget Controller</h1>
        <button onClick={() => void handleRefresh()} disabled={state === "loading"} className="text-xs px-3 py-1.5 rounded-full text-white font-semibold disabled:opacity-50" style={{ background: "var(--elevay-gradient-btn, linear-gradient(90deg, #17c3b2, #FF7A3D))" }}>
          {state === "loading" ? "Syncing..." : "Refresh Data"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {state === "idle" && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">💰</div>
            <h2 className="text-lg font-semibold mb-1">Financial Command Center</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">Monitor your marketing budget health, detect anomalies, simulate reallocations, and get AI-powered recommendations.</p>
          </div>
        )}

        {state === "loading" && (
          <div className="text-center py-8">
            <div className="inline-block h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-2 text-sm text-muted-foreground">Syncing data and calculating health score...</p>
          </div>
        )}

        {data && (
          <>
            <AlertBanner alerts={data.activeAlerts} />

            <div className="flex items-start gap-6 flex-wrap">
              <HealthScoreRing score={data.healthScore} />
              {data.lastSyncAt && (
                <p className="text-[10px] text-muted-foreground mt-2">Last sync: {new Date(data.lastSyncAt).toLocaleString()}</p>
              )}
            </div>

            {data.channelMetrics.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider text-muted-foreground">Channels</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.channelMetrics.map((m) => (
                    <ChannelCard key={m.channel} metrics={m} />
                  ))}
                </div>
              </div>
            )}

            {data.lastProjection && (
              <div className="rounded-xl border p-4 space-y-2">
                <h3 className="text-sm font-semibold">Annual Projection</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-green-600 font-semibold">Optimistic</p>
                    <p>€{data.lastProjection.scenarios.optimistic.revenue.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-blue-600 font-semibold">Nominal</p>
                    <p>€{data.lastProjection.scenarios.nominal.revenue.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-red-600 font-semibold">Pessimistic</p>
                    <p>€{data.lastProjection.scenarios.pessimistic.revenue.toLocaleString()}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Target: €{data.lastProjection.revenueTarget.toLocaleString()}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
