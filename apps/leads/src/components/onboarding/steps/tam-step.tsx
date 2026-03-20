"use client";

import { useState, useEffect, useCallback } from "react";
import { Spinner, CheckCircle, MagnifyingGlass, ChartBar, Lightning } from "@phosphor-icons/react";
import { useOnboarding, type StepAction } from "../onboarding-context";
import { TAMSummary } from "../../tam/tam-summary";
import { TAMTable } from "../../tam/tam-table";

// ─── Types ───────────────────────────────────────────────

interface TAMProgressEvent {
  type: "progress" | "complete" | "error";
  phase?: string;
  message?: string;
  data?: Record<string, unknown>;
  result?: {
    total: number;
    burningEstimate: number;
    leadsCount: number;
    roles: string[];
    buildDurationMs: number;
  };
}

interface TAMResult {
  icp: { roles: Array<{ title: string }> };
  counts: {
    total: number;
    byRole: Array<{ role: string; count: number }>;
    byGeo: Array<{ region: string; count: number }>;
  };
  leads: Array<Record<string, unknown>>;
  burningEstimate: number;
}

// ─── Phase Icons ─────────────────────────────────────────

const PHASE_META: Record<string, { icon: typeof Spinner; label: string }> = {
  inferring: { icon: MagnifyingGlass, label: "Analyzing your offer..." },
  counting: { icon: ChartBar, label: "Counting your market..." },
  sampling: { icon: MagnifyingGlass, label: "Finding sample leads..." },
  signals: { icon: Lightning, label: "Detecting buying signals..." },
  scoring: { icon: ChartBar, label: "Scoring leads..." },
  persisting: { icon: CheckCircle, label: "Saving results..." },
};

// ─── Component ───────────────────────────────────────────

export function TAMStep() {
  const { state, nextStep, setStepAction } = useOnboarding();
  const [phase, setPhase] = useState<string>("idle");
  const [message, setMessage] = useState("");
  const [tamResult, setTamResult] = useState<TAMResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);

  // Auto-start TAM build when step mounts (if not already built)
  const startBuild = useCallback(async () => {
    if (isBuilding || tamResult) return;
    setIsBuilding(true);
    setError(null);

    try {
      const res = await fetch("/api/tam/build", { method: "POST" });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "TAM build failed" }));
        setError(body.error ?? "TAM build failed");
        setIsBuilding(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("No response stream");
        setIsBuilding(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as TAMProgressEvent;

            if (event.type === "progress") {
              setPhase(event.phase ?? "");
              setMessage(event.message ?? "");
            } else if (event.type === "complete") {
              setPhase("complete");

              // Fetch full TAM result from tRPC
              const tamRes = await fetch("/api/trpc/workspace.getTAM");
              const tamData = await tamRes.json();
              const result = tamData?.result?.data?.result as TAMResult | undefined;
              if (result) {
                setTamResult(result);
              }
            } else if (event.type === "error") {
              setError(event.message ?? "TAM build failed");
            }
          } catch {
            // Ignore malformed events
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsBuilding(false);
    }
  }, [isBuilding, tamResult]);

  // Auto-start on mount if DNA exists
  useEffect(() => {
    if (state.analysisComplete && !tamResult && !isBuilding && !error) {
      startBuild();
    }
  }, [state.analysisComplete, tamResult, isBuilding, error, startBuild]);

  // Update step action button
  useEffect(() => {
    if (tamResult) {
      setStepAction({
        label: "Continue",
        onClick: nextStep,
      });
    } else if (error) {
      setStepAction({
        label: "Retry",
        onClick: () => {
          setError(null);
          startBuild();
        },
      });
    } else {
      setStepAction({
        label: "Building your TAM...",
        onClick: () => {},
        disabled: true,
        loading: true,
      });
    }
  }, [tamResult, error, setStepAction, nextStep, startBuild]);

  // ─── Error State ────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-6">
        <p className="text-sm text-destructive">{error}</p>
        <p className="text-xs text-muted-foreground">
          Make sure Apollo is connected in your integrations.
        </p>
      </div>
    );
  }

  // ─── Building State ─────────────────────────────────────
  if (!tamResult) {
    const phaseMeta = PHASE_META[phase];
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-6">
        <div className="relative">
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
            {phaseMeta ? (
              <phaseMeta.icon className="size-5 text-primary animate-pulse" weight="duotone" />
            ) : (
              <Spinner className="size-5 text-primary animate-spin" />
            )}
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-foreground">
            {phaseMeta?.label ?? "Preparing..."}
          </p>
          <p className="text-xs text-muted-foreground max-w-xs">{message}</p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-2">
          {Object.entries(PHASE_META).map(([key, meta]) => {
            const isActive = key === phase;
            const isPast = Object.keys(PHASE_META).indexOf(key) < Object.keys(PHASE_META).indexOf(phase);
            return (
              <div
                key={key}
                className={`flex items-center gap-1 ${isActive ? "text-primary font-medium" : isPast ? "text-emerald-600" : ""}`}
              >
                {isPast ? (
                  <CheckCircle className="size-3" weight="fill" />
                ) : isActive ? (
                  <Spinner className="size-3 animate-spin" />
                ) : (
                  <div className="size-3 rounded-full border border-muted-foreground/30" />
                )}
                <span className="hidden sm:inline">{meta.label.replace("...", "")}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Results State ──────────────────────────────────────
  return (
    <div className="space-y-4 pb-2">
      <TAMSummary
        total={tamResult.counts.total}
        burningEstimate={tamResult.burningEstimate}
        byRole={tamResult.counts.byRole}
        byGeo={tamResult.counts.byGeo}
        roles={tamResult.icp.roles.map((r) => r.title)}
      />

      {tamResult.leads.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            Sample Leads
          </p>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <TAMTable leads={tamResult.leads as any} />
        </div>
      )}
    </div>
  );
}
