"use client"

import { useState, useEffect } from "react"
import type { ProcessingResult } from "@/agents/social-interaction-manager/core/types"
import { NoConfigBanner } from "@/components/ui-brand-intel/no-config-banner"
import { checkNoConfig, type NoConfigInfo } from "@/lib/no-config-check"

type FilterPlatform = "all" | "instagram" | "facebook" | "linkedin" | "x" | "tiktok" | "reddit"

const PLATFORM_ICONS: Record<string, string> = {
  instagram: "📸", facebook: "📘", linkedin: "💼",
  x: "𝕏", tiktok: "🎵", reddit: "🔴",
}

const CATEGORY_COLORS: Record<string, string> = {
  lead: "bg-green-100 text-green-700",
  negative: "bg-red-100 text-red-700",
  toxic: "bg-red-200 text-red-800",
  support: "bg-blue-100 text-blue-700",
  "product-question": "bg-purple-100 text-purple-700",
  partnership: "bg-indigo-100 text-indigo-700",
  influencer: "bg-yellow-100 text-yellow-700",
  positive: "bg-teal-100 text-teal-700",
  neutral: "bg-gray-100 text-gray-600",
  spam: "bg-gray-200 text-gray-500",
}

const SENTIMENT_DOTS: Record<string, string> = {
  positive: "bg-green-500",
  neutral: "bg-gray-400",
  negative: "bg-red-500",
  urgent: "bg-red-600 animate-pulse",
}

export function UnifiedInbox() {
  const [interactions, setInteractions] = useState<ProcessingResult[]>([])
  const [filter, setFilter] = useState<FilterPlatform>("all")
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ProcessingResult | null>(null)
  const [noConfig, setNoConfig] = useState<NoConfigInfo | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/agents/social-interaction-manager/chat")
        const nc = await checkNoConfig(res)
        if (nc) { setNoConfig(nc); return }
        if (res.ok) {
          const data = (await res.json()) as { interactions: ProcessingResult[] }
          setInteractions(data.interactions ?? [])
        }
      } catch { /* ignore */ } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const filtered = filter === "all"
    ? interactions
    : interactions.filter((i) => i.message.platform === filter)

  const stats = {
    total: interactions.length,
    autoResponded: interactions.filter((i) => i.responseSent).length,
    leads: interactions.filter((i) => i.classification.category === "lead").length,
    escalations: interactions.filter((i) => i.escalation).length,
  }

  const pillClass = (active: boolean) =>
    `rounded-full px-2.5 py-1 text-xs font-medium border cursor-pointer transition-all ${active ? "bg-foreground text-background" : "bg-background text-foreground/70 border-border hover:border-foreground/30"}`

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0" style={{ height: "48px", minHeight: "48px" }}>
        <h1 className="text-lg font-semibold">Social Inbox</h1>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{stats.total} messages</span>
          <span className="text-teal-600">{stats.autoResponded} auto</span>
          <span className="text-green-600">{stats.leads} leads</span>
          {stats.escalations > 0 && <span className="text-red-600 font-semibold">{stats.escalations} escalations</span>}
        </div>
      </div>

      {noConfig && (
        <div className="px-4 pt-4 sm:px-6">
          <NoConfigBanner missing={noConfig.missing} tab={noConfig.tab} agentName="Social Inbox" />
        </div>
      )}

      <div className="flex-1 overflow-hidden flex">
        {/* Message list */}
        <div className="w-80 border-r overflow-y-auto">
          {/* Platform filters */}
          <div className="p-3 border-b flex flex-wrap gap-1.5">
            {(["all", "instagram", "facebook", "linkedin", "x", "tiktok", "reddit"] as FilterPlatform[]).map((p) => (
              <button key={p} className={pillClass(filter === p)} onClick={() => setFilter(p)}>
                {p === "all" ? "All" : PLATFORM_ICONS[p] ?? p}
              </button>
            ))}
          </div>

          {loading && <div className="p-4 text-sm text-muted-foreground">Loading...</div>}

          {!loading && filtered.length === 0 && (
            <div className="p-6 text-center">
              <div className="text-3xl mb-2">📭</div>
              <p className="text-sm text-muted-foreground">No messages yet</p>
            </div>
          )}

          {filtered.map((interaction, i) => (
            <button
              key={`${interaction.message.id}-${i}`}
              onClick={() => setSelected(interaction)}
              className={`w-full text-left p-3 border-b hover:bg-muted/50 transition-colors ${selected?.message.id === interaction.message.id ? "bg-muted/70" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{PLATFORM_ICONS[interaction.message.platform] ?? "💬"}</span>
                <span className="text-xs font-medium truncate">@{interaction.message.author.handle}</span>
                <span className={`w-2 h-2 rounded-full ${SENTIMENT_DOTS[interaction.classification.sentiment] ?? "bg-gray-400"}`} />
                {interaction.responseSent && <span className="text-[9px] px-1 rounded bg-teal-100 text-teal-700">Auto</span>}
              </div>
              <p className="text-xs text-muted-foreground truncate">{interaction.message.content}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[interaction.classification.category] ?? "bg-gray-100"}`}>
                  {interaction.classification.category}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Detail view */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {!selected ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">💬</div>
              <h2 className="text-lg font-semibold mb-1">Unified Inbox</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Centralize all social media interactions. AI classifies, responds,
                qualifies leads and escalates critical issues automatically.
              </p>
            </div>
          ) : (
            <div className="max-w-2xl space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{PLATFORM_ICONS[selected.message.platform] ?? "💬"}</span>
                <div>
                  <p className="font-semibold">{selected.message.author.name}</p>
                  <p className="text-xs text-muted-foreground">@{selected.message.author.handle} · {selected.message.author.followers?.toLocaleString() ?? "?"} followers</p>
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-sm">{selected.message.content}</p>
                <p className="text-[10px] text-muted-foreground mt-2">{new Date(selected.message.timestamp).toLocaleString()}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${CATEGORY_COLORS[selected.classification.category]}`}>
                  {selected.classification.category}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-muted">
                  Sentiment: {selected.classification.sentimentScore}/10
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-muted">
                  Confidence: {(selected.classification.confidence * 100).toFixed(0)}%
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-muted">
                  Layer {selected.classification.layer}
                </span>
              </div>

              {selected.response && (
                <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
                  <p className="text-xs font-semibold text-teal-700 mb-1">
                    {selected.responseSent ? "Auto-response sent" : "Draft response"}
                  </p>
                  <p className="text-sm">{selected.response}</p>
                </div>
              )}

              {selected.escalation && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-xs font-semibold text-red-700 mb-1">Escalation: {selected.escalation.level}</p>
                  <p className="text-sm">{selected.escalation.actionTaken}</p>
                </div>
              )}

              {selected.leadQualification && selected.leadQualification.score > 0 && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <p className="text-xs font-semibold text-green-700 mb-1">Lead Score: {selected.leadQualification.score}/100</p>
                  {selected.leadQualification.need && <p className="text-xs">Need: {selected.leadQualification.need}</p>}
                  {selected.leadQualification.timeline && <p className="text-xs">Timeline: {selected.leadQualification.timeline}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
