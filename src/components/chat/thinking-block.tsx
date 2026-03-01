"use client";

import { useState } from "react";
import { useAgentActivity } from "./agent-chat";
import type { ThinkingStep } from "./agent-chat";

// Deduplicate steps: if the same label appears multiple times (retries),
// only show one entry with the latest status.
function deduplicateSteps(steps: ThinkingStep[]): ThinkingStep[] {
  const seen = new Map<string, ThinkingStep>();
  for (const step of steps) {
    seen.set(step.label, step);
  }
  return Array.from(seen.values());
}

export function ThinkingBlock() {
  const { steps, isThinking, isStreaming } = useAgentActivity();
  const [collapsed, setCollapsed] = useState(false);

  const visibleSteps = deduplicateSteps(steps);
  const doneCount = visibleSteps.filter((s) => s.status === "done").length;
  const allDone = doneCount === visibleSteps.length && !isThinking;

  // Never hide while streaming — more steps may be coming.
  // Only hide when stream is fully done AND all steps completed.
  if (visibleSteps.length === 0) return null;
  if (allDone && !isStreaming) return null;

  return (
    <div
      className="flex gap-3 items-start max-w-[85%] motion-safe:animate-[fade-in-up_0.25s_ease-out]"
      role="status"
      aria-label={
        isThinking
          ? "LeadSens is analyzing..."
          : `${doneCount} steps completed`
      }
    >
      {/* Avatar (same as assistant message) */}
      <div className="relative shrink-0">
        <div className="size-8 rounded-lg overflow-hidden">
          <img src="/L.svg" alt="LeadSens" className="size-8" />
        </div>
      </div>

      {/* Thinking card */}
      <div className="rounded-xl border border-indigo-500/15 bg-indigo-500/[0.04] dark:bg-indigo-500/[0.08] px-4 py-3 min-w-0 w-full">
        {/* Header — clickable to collapse/expand when done */}
        <button
          type="button"
          onClick={() => allDone && setCollapsed((c) => !c)}
          className={`flex items-center gap-2 text-xs font-medium w-full text-left ${
            allDone
              ? "cursor-pointer hover:text-indigo-400 transition-colors"
              : "cursor-default"
          }`}
        >
          {isThinking ? (
            <span className="thinking-spinner size-3.5 rounded-full border-[1.5px] border-indigo-500/30 border-t-indigo-500 shrink-0" />
          ) : (
            <svg
              className={`size-3.5 shrink-0 text-indigo-500/70 transition-transform duration-200 ${
                collapsed ? "" : "rotate-90"
              }`}
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" />
            </svg>
          )}
          <span className="text-muted-foreground">
            {isThinking
              ? "Réflexion en cours..."
              : `${doneCount} étape${doneCount > 1 ? "s" : ""} terminée${doneCount > 1 ? "s" : ""}`}
          </span>
        </button>

        {/* Steps list */}
        {!collapsed && (
          <div className="mt-2 space-y-1.5 border-l-2 border-indigo-500/15 ml-[7px] pl-3">
            {visibleSteps.map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StepRow({ step }: { step: ThinkingStep }) {
  return (
    <div className="flex items-center gap-2 text-xs motion-safe:animate-[step-in_0.2s_ease-out]">
      <StepIcon status={step.status} />
      <span
        className={
          step.status === "running"
            ? "text-foreground/80"
            : step.status === "error"
              ? "text-destructive/80"
              : "text-muted-foreground"
        }
      >
        {step.label}
      </span>
    </div>
  );
}

function StepIcon({ status }: { status: ThinkingStep["status"] }) {
  if (status === "running") {
    return (
      <span className="thinking-spinner size-3 rounded-full border-[1.5px] border-indigo-500/30 border-t-indigo-500 shrink-0" />
    );
  }
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
  // error
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
