"use client"

import type { GeneratedVariation } from "@/agents/social-content-writer/core/types"
import { PLATFORM_CONFIGS } from "@/agents/social-content-writer/core/constants"
import { useState } from "react"

interface PlatformPreviewCardProps {
  variation: GeneratedVariation
  onCopy: () => void
  onRegenerate: () => void
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: "📸",
  facebook: "📘",
  tiktok: "🎵",
  linkedin: "💼",
  pinterest: "📌",
  threads: "🧵",
  youtube: "🎬",
  x: "𝕏",
}

const FORMAT_BADGES: Record<string, { label: string; color: string }> = {
  caption: { label: "Caption", color: "bg-blue-100 text-blue-700" },
  "long-form": { label: "Long-form", color: "bg-purple-100 text-purple-700" },
  thread: { label: "Thread", color: "bg-orange-100 text-orange-700" },
  "reddit-ama": { label: "Reddit", color: "bg-red-100 text-red-700" },
  article: { label: "Article", color: "bg-green-100 text-green-700" },
}

export function PlatformPreviewCard({
  variation,
  onCopy,
  onRegenerate,
}: PlatformPreviewCardProps) {
  const [copied, setCopied] = useState(false)
  const cfg = PLATFORM_CONFIGS[variation.platform]
  const icon = PLATFORM_ICONS[variation.platform] ?? "📝"
  const badge = FORMAT_BADGES[variation.format] ?? {
    label: variation.format,
    color: "bg-gray-100 text-gray-700",
  }

  const isOverLimit = variation.characterCount > variation.characterLimit
  const charPercent = Math.min(
    100,
    (variation.characterCount / variation.characterLimit) * 100,
  )

  function handleCopy() {
    navigator.clipboard.writeText(variation.content)
    setCopied(true)
    onCopy()
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="font-semibold text-sm">{cfg.name}</span>
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.color}`}
          >
            {badge.label}
          </span>
          {variation.variationIndex > 0 && (
            <span className="text-[10px] text-muted-foreground">
              V{variation.variationIndex + 1}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        {variation.content}
      </div>

      {/* Hashtags */}
      {variation.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {variation.hashtags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* CTA */}
      {variation.cta && (
        <div className="text-xs text-muted-foreground italic">
          CTA: {variation.cta}
        </div>
      )}

      {/* Character count bar */}
      <div className="space-y-1">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isOverLimit ? "bg-red-500" : charPercent > 80 ? "bg-orange-400" : "bg-teal-500"}`}
            style={{ width: `${charPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>
            {variation.characterCount} / {variation.characterLimit} chars
          </span>
          {isOverLimit && (
            <span className="text-red-500 font-medium">Over limit!</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleCopy}
          className="text-xs px-3 py-1.5 rounded-full border hover:bg-muted transition-colors font-medium"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        <button
          onClick={onRegenerate}
          className="text-xs px-3 py-1.5 rounded-full border hover:bg-muted transition-colors font-medium"
        >
          Regenerate
        </button>
      </div>

      {/* Media suggestions */}
      {variation.mediaSuggestions && variation.mediaSuggestions.length > 0 && (
        <div className="text-[11px] text-muted-foreground border-t pt-2 mt-2">
          <span className="font-medium">Media:</span>{" "}
          {variation.mediaSuggestions.join(" · ")}
        </div>
      )}
    </div>
  )
}
