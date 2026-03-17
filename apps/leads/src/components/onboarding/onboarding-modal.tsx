"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@phosphor-icons/react";
import {
  OnboardingProvider,
  useOnboarding,
  TOTAL_STEPS,
  type OnboardingState,
} from "./onboarding-context";
import { WelcomeStep } from "./steps/welcome-step";
import { CompanyUrlStep } from "./steps/company-url-step";
import { IntegrationsStep } from "./steps/integrations-step";
import { AutonomyStep } from "./steps/autonomy-step";
import { ReadyStep } from "./steps/ready-step";

// ─── Progress bar ──────────────────────────────────────

const STEP_LABELS = [
  "About you",
  "Company website",
  "Connect tools",
  "Autonomy",
  "Ready",
];

function ProgressBar() {
  const { state, totalSteps } = useOnboarding();
  const progress = ((state.currentStep + 1) / totalSteps) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
        <span>
          Step {state.currentStep + 1} of {totalSteps}
        </span>
        <span>{STEP_LABELS[state.currentStep]}</span>
      </div>
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#17C3B2] via-[#2C6BED] to-[#FF7A3D] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ─── Inner modal (needs context) ──────────────────────

function OnboardingModalInner({ onDone }: { onDone: () => void }) {
  const { state, prevStep, stepAction } = useOnboarding();

  const handleComplete = useCallback(async () => {
    try {
      await fetch("/api/trpc/workspace.completeOnboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName: state.companyName || undefined,
          senderRole: state.senderRole || undefined,
          autonomyLevel: state.autonomyLevel,
          teamSize: state.teamSize || undefined,
        }),
      });
    } catch {
      // Best-effort — still close the modal
    }
    onDone();
  }, [
    state.companyName,
    state.senderRole,
    state.autonomyLevel,
    state.teamSize,
    onDone,
  ]);

  const handleSkip = useCallback(async () => {
    try {
      await fetch("/api/trpc/workspace.skipOnboarding", { method: "POST" });
    } catch {
      // Best-effort
    }
    onDone();
  }, [onDone]);

  const steps: ReactNode[] = [
    <WelcomeStep key="welcome" />,
    <CompanyUrlStep key="company-url" />,
    <IntegrationsStep key="integrations" />,
    <AutonomyStep key="autonomy" />,
    <ReadyStep key="ready" onComplete={handleComplete} />,
  ];

  const animation =
    state.direction === "forward"
      ? "animate-in fade-in slide-in-from-right-4"
      : "animate-in fade-in slide-in-from-left-4";

  return (
    <Dialog open modal>
      <DialogContent
        className="sm:max-w-xl"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Mesh gradient background */}
        <div className="absolute inset-0 bg-leadsens-mesh opacity-30 pointer-events-none rounded-lg -z-10" />

        <div className="flex flex-col h-[400px]">
          <DialogTitle className="sr-only">LeadSens Setup</DialogTitle>

          <ProgressBar />

          {/* Fixed logo — visible on all steps */}
          <div className="flex justify-center pt-2 shrink-0">
            <div className="size-7 overflow-hidden rounded-lg">
              <img src="/L.svg" alt="LeadSens" className="size-7" />
            </div>
          </div>

          {/* Animated step content — fills space, scrolls invisibly */}
          <div
            key={state.currentStep}
            className={`flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] pt-2 px-2 ${animation} duration-200`}
          >
            {steps[state.currentStep]}
          </div>

          {/* Fixed footer — always pinned to bottom */}
          <div className="shrink-0 pt-2">
            {/* Secondary slot — always h-5 for stable button position */}
            <div className="h-5 flex items-center justify-center">
              {stepAction?.secondary}
            </div>

            {/* Primary action button — always same Y */}
            {stepAction && (
              <Button
                className="w-full bg-gradient-to-r from-[#17C3B2] via-[#2C6BED] to-[#FF7A3D] [background-size:120%_100%] [background-position:center] hover:from-[#14b0a0] hover:via-[#245ec9] hover:to-[#e56d35] border-0 text-white"
                onClick={stepAction.onClick}
                disabled={stepAction.disabled}
              >
                {stepAction.loading ? <Spinner className="size-3.5 animate-spin mr-1.5" /> : null}
                {stepAction.label}
              </Button>
            )}

            {/* Back (left) + Skip (right) — single row */}
            <div className="flex justify-between items-center pt-1">
              <button
                type="button"
                className={`text-xs text-muted-foreground hover:text-foreground transition-colors ${state.currentStep > 0 ? "" : "invisible"}`}
                onClick={prevStep}
              >
                Back
              </button>
              <button
                type="button"
                className={`text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors ${state.currentStep > 0 && state.currentStep < TOTAL_STEPS - 1 ? "" : "invisible"}`}
                onClick={handleSkip}
              >
                Skip setup entirely
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Public component ──────────────────────────────────

export function OnboardingModal() {
  const { data: session } = useSession();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [initialState, setInitialState] = useState<Partial<OnboardingState>>({});

  useEffect(() => {
    fetch("/api/trpc/workspace.getOnboardingData")
      .then((r) => r.json())
      .then((data) => {
        const d = data?.result?.data;
        if (!d) {
          setNeedsOnboarding(false);
          return;
        }

        // Already completed onboarding
        if (d.onboardingCompletedAt) {
          setNeedsOnboarding(false);
          return;
        }

        // Pre-fill from existing data
        const espIntegration = d.integrations?.find(
          (i: { type: string; status: string }) =>
            ["INSTANTLY", "SMARTLEAD", "LEMLIST"].includes(i.type) &&
            i.status === "ACTIVE",
        );
        const toolIntegrations = (d.integrations ?? [])
          .filter(
            (i: { type: string; status: string }) =>
              ["APOLLO", "ZEROBOUNCE"].includes(i.type) && i.status === "ACTIVE",
          )
          .map((i: { type: string }) => i.type);
        const crmIntegration = d.integrations?.find(
          (i: { type: string; status: string }) =>
            ["HUBSPOT", "SALESFORCE"].includes(i.type) && i.status === "ACTIVE",
        );

        setInitialState({
          userName: session?.user?.name?.split(" ")[0] ?? "",
          companyName: d.name ?? "",
          companyUrl: d.companyUrl ?? "",
          autonomyLevel: d.autonomyLevel ?? "SUPERVISED",
          connectedEsp: espIntegration?.type ?? null,
          connectedTools: toolIntegrations,
          connectedCrm: crmIntegration?.type ?? null,
          analysisComplete: !!d.companyDna,
        });
        setNeedsOnboarding(true);
      })
      .catch(() => {
        setNeedsOnboarding(false);
      });
  }, [session?.user?.name]);

  if (needsOnboarding !== true) return null;

  return (
    <OnboardingProvider initialState={initialState}>
      <OnboardingModalInner onDone={() => setNeedsOnboarding(false)} />
    </OnboardingProvider>
  );
}
