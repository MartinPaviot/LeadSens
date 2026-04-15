"use client"

import { useState, useCallback } from "react"
import { sanitizeHtml } from "@/lib/sanitize-html"
import type { EmailDraft, SMSDraft } from "@/agents/crm-campaign-manager/core/types"
import type { TimingProposal } from "@/agents/crm-campaign-manager/modules/timing-optimizer"
import { toast } from "sonner"

type CockpitState = "idle" | "loading" | "draft-ready" | "scheduled" | "error"

interface CampaignResult {
  emailDraft?: EmailDraft
  smsDraft?: SMSDraft
  timingProposals: TimingProposal[]
}

export function CampaignCockpit() {
  const [state, setState] = useState<CockpitState>("idle")
  const [result, setResult] = useState<CampaignResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Brief form state
  const [objective, setObjective] = useState("sale")
  const [segment, setSegment] = useState("all")
  const [channel, setChannel] = useState("email")
  const [tone, setTone] = useState("promotional")
  const [offerUrl, setOfferUrl] = useState("")

  const handleGenerate = useCallback(async () => {
    setState("loading")
    setError(null)

    try {
      const response = await fetch("/api/agents/crm-campaign-manager/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective,
          segment,
          channel,
          platform: "hubspot",
          tone,
          offerUrl: offerUrl || undefined,
          abConfig: { enabled: true, variable: "subject", sampleSize: 20, winCriteria: "open_rate", decisionDelay: 4 },
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error((err as Record<string, string>).error ?? "Generation failed")
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response stream")

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
              const data = JSON.parse(line.slice(6)) as Record<string, unknown>
              if ("emailDraft" in data || "smsDraft" in data) {
                setResult({
                  emailDraft: data.emailDraft as EmailDraft | undefined,
                  smsDraft: data.smsDraft as SMSDraft | undefined,
                  timingProposals: (data.timingProposals ?? []) as TimingProposal[],
                })
                setState("draft-ready")
              }
            } catch { /* skip malformed */ }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setState("error")
    }
  }, [objective, segment, channel, tone, offerUrl])

  const pillClass = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium border transition-all cursor-pointer ${
      active
        ? "bg-foreground text-background border-foreground"
        : "bg-background text-foreground/70 border-border hover:border-foreground/30"
    }`

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 sm:px-6 flex items-center gap-3 shrink-0" style={{ height: "48px", minHeight: "48px" }}>
        <h1 className="text-lg font-semibold">CRM Campaigns</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Brief Form */}
        <div className="max-w-2xl mx-auto space-y-5">
          <div>
            <label className="text-sm font-medium block mb-2">Objective</label>
            <div className="flex flex-wrap gap-2">
              {["sale", "retention", "reactivation", "activation", "event"].map((o) => (
                <button key={o} className={pillClass(objective === o)} onClick={() => setObjective(o)}>
                  {o.charAt(0).toUpperCase() + o.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">Segment</label>
            <div className="flex flex-wrap gap-2">
              {["all", "new", "inactive", "vip", "buyers"].map((s) => (
                <button key={s} className={pillClass(segment === s)} onClick={() => setSegment(s)}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">Channel</label>
            <div className="flex gap-2">
              {["email", "sms", "both"].map((c) => (
                <button key={c} className={pillClass(channel === c)} onClick={() => setChannel(c)}>
                  {c.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">Tone</label>
            <div className="flex flex-wrap gap-2">
              {["promotional", "informational", "urgency", "storytelling", "minimal"].map((t) => (
                <button key={t} className={pillClass(tone === t)} onClick={() => setTone(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">Offer URL (optional)</label>
            <input
              type="url"
              value={offerUrl}
              onChange={(e) => setOfferUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <button
            onClick={() => void handleGenerate()}
            disabled={state === "loading"}
            className="px-5 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--elevay-gradient-btn, linear-gradient(90deg, #17c3b2, #FF7A3D))" }}
          >
            {state === "loading" ? "Generating..." : "Generate Campaign"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="max-w-2xl mx-auto p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
        )}

        {/* Loading */}
        {state === "loading" && (
          <div className="max-w-2xl mx-auto text-center py-8">
            <div className="inline-block h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-2 text-sm text-muted-foreground">Generating your campaign draft...</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Timing proposals */}
            {result.timingProposals.length > 0 && (
              <div className="rounded-xl border p-4 space-y-2">
                <h3 className="text-sm font-semibold">Optimal Send Time</h3>
                {result.timingProposals.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-teal-100 text-teal-700" : "bg-muted text-muted-foreground"}`}>
                      {i + 1}
                    </span>
                    <span className="font-medium">{t.date} at {t.time}</span>
                    <span className="text-muted-foreground">— {t.reason}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Email draft */}
            {result.emailDraft && (
              <div className="rounded-xl border p-4 space-y-3">
                <h3 className="text-sm font-semibold">Email Draft</h3>
                <div className="space-y-2">
                  <div className="text-sm"><span className="font-medium">Subject:</span> {result.emailDraft.subject}</div>
                  <div className="text-sm text-muted-foreground"><span className="font-medium">Pre-header:</span> {result.emailDraft.preHeader}</div>
                  <div className="text-sm border rounded-lg p-3 bg-muted/30" dangerouslySetInnerHTML={{ __html: sanitizeHtml(result.emailDraft.bodyHtml) }} />
                  <div className="text-sm">
                    <span className="font-medium">CTA:</span>{" "}
                    <span className="px-3 py-1 rounded-full text-white text-xs font-semibold" style={{ background: "var(--elevay-gradient-btn, #17c3b2)" }}>
                      {result.emailDraft.cta.text}
                    </span>
                  </div>
                  {result.emailDraft.variantB && (
                    <div className="border-t pt-3 mt-3">
                      <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Variant B</span>
                      {result.emailDraft.variantB.subject && (
                        <div className="text-sm mt-1"><span className="font-medium">Subject B:</span> {result.emailDraft.variantB.subject}</div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => toast.info("Scheduling coming soon")}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold text-white"
                  style={{ background: "var(--elevay-gradient-btn, #17c3b2)" }}
                >
                  Schedule Send
                </button>
              </div>
            )}

            {/* SMS draft */}
            {result.smsDraft && (
              <div className="rounded-xl border p-4 space-y-2">
                <h3 className="text-sm font-semibold">SMS Draft</h3>
                <div className="text-sm bg-muted/30 rounded-lg p-3 font-mono">{result.smsDraft.message}</div>
                <div className="text-xs text-muted-foreground">{result.smsDraft.characterCount}/160 characters</div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {state === "idle" && (
          <div className="max-w-2xl mx-auto text-center py-12">
            <div className="text-4xl mb-3">📧</div>
            <h2 className="text-lg font-semibold mb-1">Campaign Cockpit</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Create, schedule and optimize email & SMS campaigns. A/B test
              subjects and CTAs. Track performance and re-target non-openers.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
