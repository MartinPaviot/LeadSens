"use client";

import {
  UsersFour,
  FunnelSimple,
  MagnifyingGlassPlus,
  PencilSimple,
  PaperPlaneRight,
  ChatCircle,
  CalendarCheck,
} from "@phosphor-icons/react";

// ─── Types ──────────────────────────────────────────────

interface PipelineNode {
  label: string;
  icon: typeof UsersFour;
  count: number;
  color: string;
  bgClass: string;
}

interface PipelineFlowProps {
  leadsTotal: number;
  leadsScored: number;
  leadsEnriched: number;
  leadsDrafted: number;
  sent: number;
  replied: number;
  meetingsBooked: number;
  status: string;
}

// ─── Status → active node index ──────────────────────────

const STATUS_TO_ACTIVE_INDEX: Record<string, number> = {
  DRAFT: -1,
  SOURCING: 0,
  SCORING: 1,
  ENRICHING: 2,
  DRAFTING: 3,
  READY: 4,
  PUSHED: 4,
  ACTIVE: 5,
  MONITORING: 6,
};

// ─── Component ──────────────────────────────────────────

export function PipelineFlow({
  leadsTotal,
  leadsScored,
  leadsEnriched,
  leadsDrafted,
  sent,
  replied,
  meetingsBooked,
  status,
}: PipelineFlowProps) {
  const nodes: PipelineNode[] = [
    { label: "Sourced", icon: UsersFour, count: leadsTotal, color: "#3b82f6", bgClass: "bg-blue-500" },
    { label: "Scored", icon: FunnelSimple, count: leadsScored, color: "#6366f1", bgClass: "bg-indigo-500" },
    { label: "Enriched", icon: MagnifyingGlassPlus, count: leadsEnriched, color: "#8b5cf6", bgClass: "bg-violet-500" },
    { label: "Drafted", icon: PencilSimple, count: leadsDrafted, color: "#f59e0b", bgClass: "bg-amber-500" },
    { label: "Sent", icon: PaperPlaneRight, count: sent, color: "#0ea5e9", bgClass: "bg-sky-500" },
    { label: "Replied", icon: ChatCircle, count: replied, color: "#10b981", bgClass: "bg-emerald-500" },
    { label: "Meetings", icon: CalendarCheck, count: meetingsBooked, color: "#16a34a", bgClass: "bg-green-600" },
  ];

  const activeIndex = STATUS_TO_ACTIVE_INDEX[status] ?? -1;

  return (
    <div className="w-full overflow-x-auto">
      <style>{`
        @keyframes pipeline-pulse {
          0%, 100% { box-shadow: 0 0 0 0 var(--pulse-color, rgba(99,102,241,0.4)); }
          50% { box-shadow: 0 0 0 8px var(--pulse-color, rgba(99,102,241,0)); }
        }
      `}</style>
      <div className="flex items-center justify-between min-w-[640px] px-2 py-6">
        {nodes.map((node, i) => {
          const isCompleted = i < activeIndex;
          const isActive = i === activeIndex;
          const isPending = i > activeIndex;
          const Icon = node.icon;

          // Drop badge between nodes
          const prevCount = i > 0 ? nodes[i - 1].count : 0;
          const drop = prevCount > 0 && node.count > 0 && node.count < prevCount
            ? prevCount - node.count
            : 0;

          return (
            <div key={node.label} className="flex items-center flex-1 last:flex-initial">
              {/* Connector line (before each node except the first) */}
              {i > 0 && (
                <div className="flex-1 flex items-center relative min-w-[24px]">
                  <div
                    className={`h-[2px] w-full ${
                      isCompleted || isActive
                        ? "bg-emerald-400/60"
                        : isPending
                          ? "bg-border/40 border-t border-dashed border-border/60"
                          : "bg-border/40"
                    }`}
                  />
                  {drop > 0 && isCompleted && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-muted-foreground/60 bg-background px-1 rounded">
                      -{drop}
                    </span>
                  )}
                </div>
              )}

              {/* Node */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  className={`relative size-12 rounded-full flex items-center justify-center transition-all ${
                    isCompleted
                      ? `${node.bgClass} text-white`
                      : isActive
                        ? `${node.bgClass} text-white`
                        : "bg-muted/40 text-muted-foreground/40"
                  }`}
                  style={
                    isActive
                      ? {
                          animation: "pipeline-pulse 2s ease-in-out infinite",
                          "--pulse-color": `${node.color}66`,
                        } as React.CSSProperties
                      : undefined
                  }
                >
                  <Icon className="size-5" weight={isCompleted || isActive ? "fill" : "regular"} />
                </div>
                <span
                  className={`text-lg font-semibold tabular-nums ${
                    isPending ? "text-muted-foreground/30" : "text-foreground"
                  }`}
                >
                  {node.count.toLocaleString()}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-wider font-medium ${
                    isPending ? "text-muted-foreground/30" : "text-muted-foreground"
                  }`}
                >
                  {node.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
