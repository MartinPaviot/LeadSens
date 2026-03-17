"use client";

import { useEffect } from "react";
import { Card, Badge } from "@leadsens/ui";
import { Hand, ShieldCheck, Robot } from "@phosphor-icons/react";
import { useOnboarding, type AutonomyLevel } from "../onboarding-context";

const AUTONOMY_OPTIONS: Array<{
  value: AutonomyLevel;
  label: string;
  description: string;
  icon: typeof Hand;
  recommended?: boolean;
}> = [
  {
    value: "MANUAL",
    label: "Manual",
    description: "Confirm every action — best for new users",
    icon: Hand,
  },
  {
    value: "SUPERVISED",
    label: "Supervised",
    description: "I handle the work, you approve key decisions",
    icon: ShieldCheck,
    recommended: true,
  },
  {
    value: "AUTO",
    label: "Full Auto",
    description: "Set it and forget it — I run everything",
    icon: Robot,
  },
];

export function AutonomyStep() {
  const { state, setState, nextStep, setStepAction } = useOnboarding();

  useEffect(() => {
    setStepAction({
      label: "Continue",
      onClick: nextStep,
    });
  }, [nextStep, setStepAction]);

  return (
    <div>
      <div className="text-center">
        <h2 className="text-lg font-semibold">
          How much control do you want?
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          You can change this anytime from the chat header
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 pt-4">
        {AUTONOMY_OPTIONS.map((opt) => {
          const isSelected = state.autonomyLevel === opt.value;

          return (
            <Card
              key={opt.value}
              className={`relative p-3.5 cursor-pointer transition-all text-center ${
                isSelected
                  ? "border-transparent ring-1 ring-[#2C6BED]/30 bg-gradient-to-br from-[#17C3B2]/10 via-[#2C6BED]/10 to-[#FF7A3D]/10"
                  : "hover:border-teal-500/30"
              }`}
              onClick={() =>
                setState((prev) => ({ ...prev, autonomyLevel: opt.value }))
              }
            >
              {opt.recommended && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0">
                  Recommended
                </Badge>
              )}
              <div className="flex flex-col items-center gap-1.5 pt-1">
                <opt.icon
                  className={`size-7 ${isSelected ? "text-[#2C6BED]" : "text-muted-foreground"}`}
                  weight={isSelected ? "fill" : "duotone"}
                />
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-muted-foreground leading-snug">
                  {opt.description}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
