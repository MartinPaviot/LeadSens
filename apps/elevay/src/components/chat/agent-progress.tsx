"use client";

import {
  ArrowClockwise,
  CheckCircle,
  XCircle,
  Circle,
  CaretDown,
  CaretUp,
} from "@phosphor-icons/react";
import { cn } from "@leadsens/ui";
import type { ModuleItem } from "./bpi-progress-context";

interface AgentProgressProps {
  modules: ModuleItem[];
  isExpanded: boolean;
  onToggle: () => void;
}

function ModuleIcon({ status }: { status: ModuleItem["status"] }) {
  if (status === "running") {
    return (
      <ArrowClockwise
        className="size-4 text-blue-500 animate-spin shrink-0"
        weight="bold"
      />
    );
  }
  if (status === "done") {
    return (
      <CheckCircle
        className="size-4 text-emerald-500 shrink-0"
        weight="fill"
      />
    );
  }
  if (status === "failed") {
    return (
      <XCircle className="size-4 text-orange-400 shrink-0" weight="fill" />
    );
  }
  return <Circle className="size-4 text-muted-foreground shrink-0" />;
}

function getActiveModule(modules: ModuleItem[]): ModuleItem | undefined {
  return (
    modules.find((m) => m.status === "running") ??
    modules.find((m) => m.status === "idle") ??
    [...modules].reverse().find((m) => m.status === "done")
  );
}

export function AgentProgress({ modules, isExpanded, onToggle }: AgentProgressProps) {
  const active = getActiveModule(modules);
  const activeLabel = active?.label ?? "Analyse";
  const activeStatus = active?.status ?? "running";

  return (
    <div className="w-full">
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 w-full text-left"
      >
        <ModuleIcon status={activeStatus === "idle" ? "running" : activeStatus} />
        <span className="flex-1 text-sm font-medium">
          {activeLabel} in progress…
        </span>
        {isExpanded ? (
          <CaretUp className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <CaretDown className="size-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded list */}
      {isExpanded && (
        <ul className="mt-3 space-y-2">
          {modules.map((mod) => (
            <li key={mod.label} className="flex items-center gap-2">
              <ModuleIcon status={mod.status} />
              <span
                className={cn(
                  "text-sm",
                  mod.status === "idle" && "text-muted-foreground",
                  mod.status === "running" && "text-blue-500 font-medium",
                  mod.status === "done" && "text-foreground",
                  mod.status === "failed" && "text-orange-400",
                )}
              >
                {mod.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
