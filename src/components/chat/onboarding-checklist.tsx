"use client";

import { useEffect, useState } from "react";
import { Check } from "@phosphor-icons/react";

interface OnboardingStep {
  key: string;
  label: string;
  done: boolean;
}

export function OnboardingChecklist() {
  const [steps, setSteps] = useState<OnboardingStep[] | null>(null);

  useEffect(() => {
    fetch("/api/trpc/workspace.getOnboardingState")
      .then((r) => r.json())
      .then((data) => {
        const s = data?.result?.data?.steps;
        if (Array.isArray(s)) setSteps(s);
      })
      .catch(() => {});
  }, []);

  // Don't render while loading or if all steps complete
  if (!steps) return null;
  const allDone = steps.every((s) => s.done);
  if (allDone) return null;

  const completedCount = steps.filter((s) => s.done).length;
  const currentStep = steps.find((s) => !s.done);

  return (
    <div className="px-4 pt-3 pb-1">
      <div className="max-w-[720px] mx-auto">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 border border-border/30">
          {/* Progress circles */}
          <div className="flex items-center gap-1.5">
            {steps.map((step) => (
              <div
                key={step.key}
                className={`size-5 rounded-full flex items-center justify-center text-[10px] font-medium transition-colors ${
                  step.done
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted border border-border/50 text-muted-foreground"
                }`}
                title={step.label}
              >
                {step.done ? (
                  <Check className="size-3" weight="bold" />
                ) : null}
              </div>
            ))}
          </div>

          {/* Current step label */}
          <div className="flex-1 min-w-0">
            <span className="text-xs text-muted-foreground">
              {completedCount}/{steps.length} —{" "}
              <span className="text-foreground font-medium">
                {currentStep?.label ?? "All done!"}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
