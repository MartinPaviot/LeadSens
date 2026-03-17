"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Confetti,
  CheckCircle,
  Spinner,
  Globe,
  Plugs,
  SlidersHorizontal,
  Users,
} from "@phosphor-icons/react";
import { useOnboarding } from "../onboarding-context";

const TEAM_SIZE_LABELS: Record<string, string> = {
  solo: "Just me",
  "2-5": "2–5",
  "6-20": "6–20",
  "21-100": "21–100",
  "100+": "100+",
};

export function ReadyStep({ onComplete }: { onComplete: () => Promise<void> }) {
  const { state, setStepAction } = useOnboarding();
  const [completing, setCompleting] = useState(false);

  const handleComplete = useCallback(async () => {
    setCompleting(true);
    try {
      await onComplete();
    } finally {
      setCompleting(false);
    }
  }, [onComplete]);

  useEffect(() => {
    setStepAction({
      label: "Start my first campaign",
      onClick: handleComplete,
      disabled: completing,
      loading: completing,
    });
  }, [completing, handleComplete, setStepAction]);

  const summaryItems: Array<{ icon: typeof Globe; label: string; value: string }> = [];

  if (state.companyName) {
    summaryItems.push({ icon: Globe, label: "Company", value: state.companyName });
  }
  if (state.teamSize) {
    summaryItems.push({ icon: Users, label: "Team", value: TEAM_SIZE_LABELS[state.teamSize] ?? state.teamSize });
  }
  if (state.connectedEsp) {
    summaryItems.push({ icon: Plugs, label: "ESP", value: state.connectedEsp.charAt(0) + state.connectedEsp.slice(1).toLowerCase() });
  }
  if (state.connectedCrm) {
    summaryItems.push({ icon: Plugs, label: "CRM", value: state.connectedCrm.charAt(0) + state.connectedCrm.slice(1).toLowerCase() });
  }
  if (state.connectedTools.length > 0) {
    summaryItems.push({ icon: Plugs, label: "Tools", value: state.connectedTools.map((t) => t.charAt(0) + t.slice(1).toLowerCase()).join(", ") });
  }
  summaryItems.push({
    icon: SlidersHorizontal,
    label: "Autonomy",
    value: state.autonomyLevel === "AUTO" ? "Full Auto" : state.autonomyLevel === "MANUAL" ? "Manual" : "Supervised",
  });

  return (
    <div>
      <div className="text-center space-y-1">
        <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <Confetti className="size-4 text-primary" weight="duotone" />
        </div>
        <h2 className="text-lg font-semibold">You&apos;re all set!</h2>
        <p className="text-[11px] text-muted-foreground">
          Here&apos;s what we configured
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5 pt-2.5">
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-muted/30"
          >
            <div className="flex items-center gap-1.5 text-[11px] min-w-0">
              <item.icon className="size-3 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">{item.label}</span>
            </div>
            <span className="text-[11px] font-medium truncate ml-1">{item.value}</span>
          </div>
        ))}
      </div>

      {state.companyUrl && (
        <div className="mt-2">
          {state.isAnalyzingUrl && (
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Spinner className="size-3 animate-spin" />
              Still analyzing your website...
            </div>
          )}
          {state.analysisComplete && (
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-green-600">
              <CheckCircle className="size-3" weight="fill" />
              Website analyzed
            </div>
          )}
          {state.analysisError && (
            <div className="flex justify-center">
              <Badge variant="outline" className="text-[10px]">
                Website analysis failed — retry from settings
              </Badge>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
