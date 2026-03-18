"use client";

import { useMemo } from "react";
import {
  Target,
  MagnifyingGlass,
  FunnelSimple,
  Sparkle,
  PencilSimple,
  PaperPlaneRight,
} from "@phosphor-icons/react";
import { useAgentActivity, type ThinkingStep } from "@leadsens/ui";

// ─── Pipeline stages ─────────────────────────────────────

interface PipelineStage {
  key: string;
  label: string;
  icon: typeof Target;
  /** Tool names that indicate this stage is active or complete */
  tools: string[];
}

const STAGES: PipelineStage[] = [
  {
    key: "icp",
    label: "ICP",
    icon: Target,
    tools: ["parse_icp", "count_leads"],
  },
  {
    key: "source",
    label: "Source",
    icon: MagnifyingGlass,
    tools: ["source_leads", "demo_search_leads"],
  },
  {
    key: "score",
    label: "Score",
    icon: FunnelSimple,
    tools: ["score_leads_batch"],
  },
  {
    key: "enrich",
    label: "Enrich",
    icon: Sparkle,
    tools: ["enrich_leads_batch"],
  },
  {
    key: "draft",
    label: "Draft",
    icon: PencilSimple,
    tools: ["draft_emails_batch", "draft_single_email"],
  },
  {
    key: "send",
    label: "Send",
    icon: PaperPlaneRight,
    tools: ["create_campaign", "add_leads_to_campaign", "activate_campaign"],
  },
];

type StageStatus = "pending" | "active" | "done";

function detectStages(steps: ThinkingStep[]): Map<string, StageStatus> {
  const statuses = new Map<string, StageStatus>();
  STAGES.forEach((s) => statuses.set(s.key, "pending"));

  // Walk through completed thinking steps and mark stages
  let lastCompletedStageIdx = -1;

  for (const step of steps) {
    const toolName = step.toolName;
    if (!toolName) continue;

    for (let i = 0; i < STAGES.length; i++) {
      const stage = STAGES[i];
      if (stage.tools.includes(toolName)) {
        if (step.status === "running") {
          statuses.set(stage.key, "active");
        } else if (step.status === "done") {
          statuses.set(stage.key, "done");
          if (i > lastCompletedStageIdx) lastCompletedStageIdx = i;
        }
      }
    }
  }

  // Mark all stages before the last completed one as done too
  for (let i = 0; i <= lastCompletedStageIdx; i++) {
    const key = STAGES[i].key;
    if (statuses.get(key) === "pending") {
      statuses.set(key, "done");
    }
  }

  return statuses;
}

// ─── Component ────────────────────────────────────────────

export function CampaignPipelineBar() {
  const { steps, isStreaming } = useAgentActivity();

  const stageStatuses = useMemo(() => detectStages(steps), [steps]);

  // Only show when at least one stage has been activated (pipeline is running)
  const hasActivity = Array.from(stageStatuses.values()).some(
    (s) => s !== "pending",
  );

  if (!hasActivity) return null;

  return (
    <div className="px-4 py-1.5 border-b bg-background/95 backdrop-blur-sm">
      <div className="max-w-[720px] mx-auto flex items-center gap-1">
        {STAGES.map((stage, idx) => {
          const status = stageStatuses.get(stage.key) ?? "pending";
          const Icon = stage.icon;

          return (
            <div key={stage.key} className="flex items-center">
              {idx > 0 && (
                <div
                  className={`w-4 sm:w-6 h-px mx-0.5 transition-colors ${
                    status === "done"
                      ? "bg-emerald-500"
                      : status === "active"
                        ? "bg-primary/50"
                        : "bg-border"
                  }`}
                />
              )}
              <div
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-medium transition-all ${
                  status === "done"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : status === "active"
                      ? "text-primary bg-primary/10 ring-1 ring-primary/20"
                      : "text-muted-foreground/40"
                }`}
              >
                <Icon
                  className={`size-3 sm:size-3.5 shrink-0 ${
                    status === "active" && isStreaming ? "animate-pulse" : ""
                  }`}
                  weight={status === "done" ? "fill" : status === "active" ? "duotone" : "regular"}
                />
                <span className="hidden sm:inline">{stage.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
