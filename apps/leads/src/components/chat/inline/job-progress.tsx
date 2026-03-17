"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";

interface JobProgressProps {
  jobId: string;
  label: string;
  total: number;
}

interface ProgressData {
  current: number;
  total: number;
  stage: string;
  status: "running" | "done" | "error" | "unknown";
  error?: string;
  completedAt?: string;
}

export function JobProgress({ jobId, label, total }: JobProgressProps) {
  const [progress, setProgress] = useState<ProgressData>({
    current: 0,
    total,
    stage: "starting",
    status: "running",
  });

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (res.ok) {
        const data = (await res.json()) as ProgressData;
        if (data.status !== "unknown") {
          setProgress(data);
        }
      }
    } catch {
      // Silently retry on next poll
    }
  }, [jobId]);

  useEffect(() => {
    // Poll every 2 seconds until done or error
    const interval = setInterval(() => {
      fetchProgress();
    }, 2000);

    // Initial fetch
    fetchProgress();

    return () => clearInterval(interval);
  }, [fetchProgress]);

  // Stop polling when done/error
  useEffect(() => {
    if (progress.status === "done" || progress.status === "error") {
      // No need to keep polling — cleanup handled by interval ref
    }
  }, [progress.status]);

  const pct = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  const isDone = progress.status === "done";
  const isError = progress.status === "error";

  return (
    <Card className="overflow-hidden my-2 border-border/60">
      <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{label}</h3>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {progress.current}/{progress.total}
          </span>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              isError
                ? "bg-red-500"
                : isDone
                  ? "bg-emerald-500"
                  : "bg-indigo-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Status text */}
        <div className="flex items-center gap-1.5">
          {isDone ? (
            <svg className="size-3.5 text-emerald-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
            </svg>
          ) : isError ? (
            <svg className="size-3.5 text-red-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4L12 12M12 4L4 12" />
            </svg>
          ) : (
            <span className="size-2 rounded-full bg-indigo-500 animate-pulse" />
          )}
          <span className={`text-xs ${
            isError ? "text-red-400" : isDone ? "text-emerald-400" : "text-muted-foreground"
          }`}>
            {isError
              ? progress.error ?? "An error occurred"
              : isDone
                ? `Completed ${progress.current} items`
                : `${progress.stage}... ${pct}%`}
          </span>
        </div>
      </div>
    </Card>
  );
}
