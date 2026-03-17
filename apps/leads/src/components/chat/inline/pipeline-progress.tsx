"use client";

import { Card } from "@leadsens/ui";

interface PipelineProgressProps {
  campaignName: string;
  status: string;
  totalLeads: number;
  scored: number;
  enriched: number;
  drafted: number;
  pushed: number;
  skipped: number;
}

const PIPELINE_STEPS = [
  { key: "SOURCING", label: "Sourced", field: "totalLeads" },
  { key: "SCORING", label: "Scored", field: "scored" },
  { key: "ENRICHING", label: "Enriched", field: "enriched" },
  { key: "DRAFTING", label: "Drafted", field: "drafted" },
  { key: "PUSHED", label: "Pushed", field: "pushed" },
] as const;

const STATUS_ORDER: Record<string, number> = {
  DRAFT: 0,
  SOURCING: 1,
  SCORING: 2,
  ENRICHING: 3,
  DRAFTING: 4,
  READY: 5,
  PUSHED: 5,
  ACTIVE: 5,
};

function getStepState(stepIdx: number, currentStatus: string): "done" | "active" | "pending" {
  const currentIdx = STATUS_ORDER[currentStatus] ?? 0;
  if (stepIdx < currentIdx) return "done";
  if (stepIdx === currentIdx) return "active";
  return "pending";
}

export function PipelineProgress({
  campaignName,
  status,
  totalLeads,
  scored,
  enriched,
  drafted,
  pushed,
  skipped,
}: PipelineProgressProps) {
  const counts: Record<string, number> = {
    totalLeads,
    scored,
    enriched,
    drafted,
    pushed,
  };

  return (
    <Card className="overflow-hidden my-2 border-border/60">
      <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{campaignName}</h3>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {totalLeads} leads{skipped > 0 ? ` · ${skipped} skipped` : ""}
          </span>
        </div>
      </div>

      <div className="px-4 py-3">
        {/* Step indicators */}
        <div className="flex items-center gap-1">
          {PIPELINE_STEPS.map((step, idx) => {
            const state = getStepState(idx, status);
            const count = counts[step.field];

            return (
              <div key={step.key} className="flex items-center flex-1 min-w-0">
                {/* Step node */}
                <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
                  <div
                    className={`
                      size-6 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0
                      transition-all duration-300
                      ${state === "done"
                        ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
                        : state === "active"
                          ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 ring-2 ring-indigo-500/20"
                          : "bg-muted/40 text-muted-foreground/40 border border-border/40"
                      }
                    `}
                  >
                    {state === "done" ? (
                      <svg className="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
                      </svg>
                    ) : state === "active" ? (
                      <span className="size-2 rounded-full bg-indigo-500 animate-pulse" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-current opacity-40" />
                    )}
                  </div>

                  <div className="text-center min-w-0">
                    <div className={`text-[10px] font-medium truncate ${
                      state === "done"
                        ? "text-emerald-500"
                        : state === "active"
                          ? "text-indigo-400"
                          : "text-muted-foreground/40"
                    }`}>
                      {step.label}
                    </div>
                    {count > 0 && (
                      <div className="text-[9px] text-muted-foreground tabular-nums">
                        {count}
                      </div>
                    )}
                  </div>
                </div>

                {/* Connector line (not after last step) */}
                {idx < PIPELINE_STEPS.length - 1 && (
                  <div className={`h-[1.5px] flex-1 min-w-2 mx-0.5 mt-[-16px] transition-colors duration-300 ${
                    getStepState(idx + 1, status) !== "pending"
                      ? "bg-emerald-500/40"
                      : state === "active"
                        ? "bg-indigo-500/20"
                        : "bg-border/40"
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
