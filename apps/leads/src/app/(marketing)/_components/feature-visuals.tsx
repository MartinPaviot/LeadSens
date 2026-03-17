/**
 * T1-03: Mini visual demos for each feature bento card.
 * Pure CSS illustrations — no images, no external deps.
 */

/** NL ICP: Chat bubble → JSON output */
export function VisualNlIcp() {
  return (
    <div className="mt-4 flex items-end gap-2">
      {/* Chat bubble */}
      <div className="rounded-xl rounded-bl-sm bg-primary/10 px-3 py-2 text-xs text-foreground/70 max-w-[180px]">
        <span className="text-muted-foreground/60 italic">&quot;SaaS CTOs in France, 50-200 employees&quot;</span>
      </div>
      {/* Arrow */}
      <svg className="size-4 shrink-0 text-muted-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
      </svg>
      {/* JSON output */}
      <div className="rounded-lg bg-muted/60 px-2.5 py-1.5 font-mono text-[10px] leading-tight text-foreground/60">
        <span className="text-[#17C3B2]">{"{"}</span>
        title: <span className="text-[#2C6BED]">&quot;CTO&quot;</span>
        <br />
        size: <span className="text-[#7C3AED]">&quot;50-200&quot;</span>
        <span className="text-[#17C3B2]">{"}"}</span>
      </div>
    </div>
  );
}

/** 3D Scoring: Three horizontal bars with labels */
export function VisualScoring() {
  const bars = [
    { label: "Fit", pct: 82, color: "#17C3B2" },
    { label: "Intent", pct: 65, color: "#2C6BED" },
    { label: "Timing", pct: 48, color: "#7C3AED" },
  ];
  return (
    <div className="mt-4 space-y-2">
      {bars.map((b) => (
        <div key={b.label} className="flex items-center gap-2">
          <span className="w-12 text-[10px] font-medium text-muted-foreground">{b.label}</span>
          <div className="h-2 flex-1 rounded-full bg-muted/60 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${b.pct}%`, backgroundColor: b.color }}
            />
          </div>
          <span className="w-8 text-right text-[10px] font-semibold" style={{ color: b.color }}>
            {b.pct}%
          </span>
        </div>
      ))}
    </div>
  );
}

/** Deep Enrichment: Stacked data cards fanning out */
export function VisualEnrichment() {
  const cards = [
    { label: "Website", icon: "W", color: "#17C3B2" },
    { label: "LinkedIn", icon: "in", color: "#2C6BED" },
    { label: "Signals", icon: "S", color: "#7C3AED" },
  ];
  return (
    <div className="mt-4 relative h-16">
      {cards.map((c, i) => (
        <div
          key={c.label}
          className="absolute left-0 flex items-center gap-2 rounded-lg border border-border/40 bg-card px-3 py-1.5 shadow-sm"
          style={{
            top: `${i * 6}px`,
            left: `${i * 16}px`,
            zIndex: 3 - i,
          }}
        >
          <div
            className="size-5 rounded flex items-center justify-center text-[9px] font-bold text-white"
            style={{ backgroundColor: c.color }}
          >
            {c.icon}
          </div>
          <span className="text-[10px] font-medium text-foreground/70">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Pro Email: Mini email preview with highlighted tokens */
export function VisualEmail() {
  return (
    <div className="mt-4 rounded-lg border border-border/40 bg-card p-3">
      <div className="mb-1.5 text-[10px] font-semibold text-muted-foreground">Subject: How <span className="rounded bg-[#17C3B2]/15 px-1 text-[#17C3B2]">{"{{company}}"}</span> handles...</div>
      <div className="text-[10px] leading-relaxed text-foreground/50">
        Hi <span className="rounded bg-[#2C6BED]/15 px-1 text-[#2C6BED]">{"{{firstName}}"}</span>, I noticed <span className="rounded bg-[#7C3AED]/15 px-1 text-[#7C3AED]">{"{{signal}}"}</span> and thought...
      </div>
    </div>
  );
}

/** A/B Testing: Two bars racing with winner checkmark */
export function VisualAbTest() {
  return (
    <div className="mt-4 space-y-2">
      {/* Variant A */}
      <div className="flex items-center gap-2">
        <span className="w-5 text-[10px] font-bold text-foreground/50">A</span>
        <div className="h-3 flex-1 rounded-full bg-muted/60 overflow-hidden">
          <div className="h-full w-[72%] rounded-full bg-[#17C3B2]" />
        </div>
        <span className="text-[10px] font-semibold text-[#17C3B2]">14.2%</span>
        <svg className="size-3.5 text-[#17C3B2]" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </div>
      {/* Variant B (paused) */}
      <div className="flex items-center gap-2 opacity-50">
        <span className="w-5 text-[10px] font-bold text-foreground/50">B</span>
        <div className="h-3 flex-1 rounded-full bg-muted/60 overflow-hidden">
          <div className="h-full w-[38%] rounded-full bg-muted-foreground/30" />
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground">6.1%</span>
        <span className="text-[9px] font-medium text-red-400">paused</span>
      </div>
    </div>
  );
}

/** Reply Management: Classification tags appearing */
export function VisualReplyManagement() {
  const tags = [
    { label: "Interested", color: "#17C3B2" },
    { label: "Meeting", color: "#2C6BED" },
    { label: "Not now", color: "#F59E0B" },
    { label: "Unsubscribe", color: "#EF4444" },
  ];
  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span
          key={t.label}
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            color: t.color,
            backgroundColor: `${t.color}15`,
          }}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}
