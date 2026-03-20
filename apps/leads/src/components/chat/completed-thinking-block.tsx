"use client";

import { useState } from "react";

interface CompletedStep {
  label: string;
  status: "running" | "done" | "error";
  summary?: string;
  startedAt?: number;
  completedAt?: number;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

function StepIcon({ status }: { status: CompletedStep["status"] }) {
  if (status === "done") {
    return (
      <svg
        className="size-3 shrink-0 text-emerald-500"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
      </svg>
    );
  }
  if (status === "error") {
    return (
      <svg
        className="size-3 shrink-0 text-destructive"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M4 4L12 12M12 4L4 12" />
      </svg>
    );
  }
  // running (shouldn't happen in completed block, but handle gracefully)
  return (
    <svg
      className="size-3 shrink-0 text-muted-foreground/50"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
    </svg>
  );
}

export function CompletedThinkingBlock({ steps }: { steps: CompletedStep[] }) {
  const [expanded, setExpanded] = useState(false);

  if (steps.length === 0) return null;

  const doneCount = steps.filter((s) => s.status === "done").length;
  const headerText = `${doneCount} step${doneCount !== 1 ? "s" : ""} completed`;

  return (
    <div className="rounded-lg border border-indigo-500/15 bg-indigo-500/[0.04] dark:bg-indigo-500/[0.08] px-3 py-2 mb-2">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-2 text-xs font-medium w-full text-left cursor-pointer hover:text-indigo-400 transition-colors"
      >
        <svg
          className={`size-3.5 shrink-0 text-indigo-500/70 transition-transform duration-200 ${
            expanded ? "rotate-90" : ""
          }`}
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" />
        </svg>
        <span className="text-muted-foreground">{headerText}</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 border-l-2 border-indigo-500/15 ml-[7px] pl-3">
          {steps.map((step, i) => {
            const duration =
              step.completedAt && step.startedAt
                ? formatDuration(step.completedAt - step.startedAt)
                : null;

            return (
              <div key={i} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 text-xs">
                  <StepIcon status={step.status} />
                  <span
                    className={
                      step.status === "error"
                        ? "text-destructive/80"
                        : "text-muted-foreground"
                    }
                  >
                    {step.label}
                  </span>
                  {duration && step.status === "done" && (
                    <span className="text-[10px] text-muted-foreground/50 ml-auto tabular-nums">
                      {duration}
                    </span>
                  )}
                </div>
                {step.summary && (step.status === "done" || step.status === "error") && (
                  <p className={`text-[11px] ml-5 pl-0.5 ${
                    step.status === "error" ? "text-destructive/60" : "text-muted-foreground/60"
                  }`}>
                    {step.summary}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
