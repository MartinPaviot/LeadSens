"use client"

import { useState, useCallback } from "react"
import type {
  GenerationOutput,
  GeneratedVariation,
} from "@/agents/social-content-writer/core/types"
import { PlatformPreviewCard } from "./PlatformPreviewCard"
import { toast } from "sonner"

type StudioState = "idle" | "loading" | "done" | "error"

export function ContentStudio() {
  const [state, setState] = useState<StudioState>("idle")
  const [output, setOutput] = useState<GenerationOutput | null>(null)
  const [briefText, setBriefText] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = useCallback(async () => {
    if (!briefText.trim()) {
      toast.error("Enter a brief first")
      return
    }

    setState("loading")
    setError(null)

    try {
      const response = await fetch("/api/agents/social-content-writer/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: "caption",
          platforms: ["linkedin", "instagram", "x"],
          objective: "engagement",
          sourceContent: briefText,
          crossPlatform: false,
          variationsCount: 2,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(
          (err as Record<string, string>).error ?? "Generation failed",
        )
      }

      // Read SSE stream
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
              if ("result" in data) {
                setOutput(data.result as GenerationOutput)
                setState("done")
              }
            } catch {
              // Skip malformed lines
            }
          }
        }
      }

      if (state !== "done") setState("done")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setState("error")
    }
  }, [briefText])

  const handleCopy = useCallback(() => {
    toast.success("Copied to clipboard")
  }, [])

  const handleRegenerate = useCallback(() => {
    toast.info("Regeneration coming soon")
  }, [])

  const handleExportCSV = useCallback(() => {
    if (!output) return
    // Build CSV
    const header = "Platform,Format,Content,Hashtags,CTA,Characters"
    const rows = output.variations.map((v) => {
      const escaped = `"${v.content.replace(/"/g, '""')}"`
      return `${v.platform},${v.format},${escaped},"${v.hashtags.join(", ")}","${v.cta}",${v.characterCount}`
    })
    const csv = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "content-export.csv"
    a.click()
    URL.revokeObjectURL(url)
    toast.success("CSV downloaded")
  }, [output])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="border-b px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0"
        style={{ height: "48px", minHeight: "48px" }}
      >
        <h1 className="text-lg font-semibold">Content Writer</h1>
        {output && (
          <button
            onClick={handleExportCSV}
            className="text-xs px-3 py-1.5 rounded-full border hover:bg-muted transition-colors font-medium"
          >
            Export CSV
          </button>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Brief input */}
        <div className="max-w-3xl mx-auto space-y-3">
          <label className="text-sm font-medium">What do you want to write about?</label>
          <textarea
            value={briefText}
            onChange={(e) => setBriefText(e.target.value)}
            placeholder="Describe your post topic, angle, or paste content to adapt..."
            className="w-full rounded-xl border bg-background px-4 py-3 text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            rows={4}
          />
          <button
            onClick={() => void handleGenerate()}
            disabled={state === "loading" || !briefText.trim()}
            className="px-5 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-50 transition-all"
            style={{ background: "var(--elevay-gradient-btn, linear-gradient(90deg, #17c3b2, #FF7A3D))" }}
          >
            {state === "loading" ? "Generating..." : "Generate Content"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="max-w-3xl mx-auto p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {state === "loading" && (
          <div className="max-w-3xl mx-auto text-center py-8">
            <div className="inline-block h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-2 text-sm text-muted-foreground">
              Generating variations for your platforms...
            </p>
          </div>
        )}

        {/* Results */}
        {output && output.variations.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {output.variations.length} variations generated
              </h2>
              {output.hashtagsUsed.length > 0 && (
                <div className="flex gap-1">
                  {output.hashtagsUsed.slice(0, 5).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {output.variations.map((v, i) => (
                <PlatformPreviewCard
                  key={`${v.platform}-${v.variationIndex}-${i}`}
                  variation={v}
                  onCopy={handleCopy}
                  onRegenerate={handleRegenerate}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {state === "idle" && (
          <div className="max-w-3xl mx-auto text-center py-12">
            <div className="text-4xl mb-3">✍️</div>
            <h2 className="text-lg font-semibold mb-1">Content Studio</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Write a brief above and generate optimized content for Instagram,
              LinkedIn, X, TikTok, and more. Each post is adapted to the
              platform&apos;s culture and best practices.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
