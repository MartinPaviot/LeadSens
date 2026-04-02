"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useOnboardingStore, clearOnboardingState } from "@/lib/onboarding-store";
import { ArrowLeft } from "@phosphor-icons/react";
import { Button } from "@leadsens/ui";
import { StepBusiness } from "@/components/onboarding/steps/step-business";
import { StepCms } from "@/components/onboarding/steps/step-cms";
import { StepTools } from "@/components/onboarding/steps/step-tools";
import { StepAutomation } from "@/components/onboarding/steps/step-automation";
import { StepNotifications } from "@/components/onboarding/steps/step-notifications";

const STEPS = [
  { id: 'business', label: 'Business', title: 'Your business', description: 'Tell us about your website so we can tailor the SEO strategy.' },
  { id: 'cms', label: 'CMS', title: 'Your CMS', description: 'Select your content management system for direct draft creation.' },
  { id: 'tools', label: 'Tools', title: 'Connect tools', description: 'Connect your SEO tools for richer insights and automation.' },
  { id: 'automation', label: 'Automation', title: 'Automation level', description: 'Choose how much control you want over changes.' },
  { id: 'notifications', label: 'Alerts', title: 'Notifications', description: 'How do you want to be notified when content is ready?' },
];

interface OnboardingOverlayProps {
  onComplete: () => void;
}

export function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  const router = useRouter();
  const { state, hydrated, setStep, updateData, updateTools } = useOnboardingStore();
  const [submitting, setSubmitting] = useState(false);

  const step = state.currentStep;
  const totalSteps = STEPS.length;
  const progress = ((step + 1) / totalSteps) * 100;
  const isLast = step === totalSteps - 1;
  const isFirst = step === 0;

  const canContinue = useCallback(() => {
    switch (step) {
      case 0: return state.data.siteUrl.length > 0;
      default: return true;
    }
  }, [step, state.data]);

  const handleNext = useCallback(async () => {
    if (isLast) {
      setSubmitting(true);
      try {
        const res = await fetch('/api/onboarding/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state.data),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(err.error ?? 'Failed to save');
        }
        clearOnboardingState();
        onComplete();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setSubmitting(false);
      }
    } else {
      setStep(step + 1);
    }
  }, [isLast, step, state.data, setStep, onComplete, router]);

  const handleBack = useCallback(() => {
    if (!isFirst) setStep(step - 1);
  }, [isFirst, step, setStep]);

  const currentStep = STEPS[step];

  if (!hydrated) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative flex h-full w-full max-w-[640px] flex-col bg-background shadow-2xl sm:mx-4 sm:my-8 sm:h-auto sm:max-h-[85vh] sm:rounded-2xl sm:border sm:border-border">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <img src="/logo-elevay.svg" alt="Elevay" className="h-7 w-7 rounded-lg" />
            <span className="text-sm font-semibold text-foreground">Set up your agents</span>
          </div>
          <span className="text-xs text-muted-foreground">Step {step + 1} of {totalSteps}</span>
        </div>

        {/* Progress */}
        <div className="h-[2px] w-full bg-muted">
          <div
            className="h-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #17C3B2, #2C6BED)' }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <h1 className="text-lg font-semibold text-foreground">{currentStep.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{currentStep.description}</p>
          <div className="mt-5">
            {step === 0 && <StepBusiness data={state.data} onChange={updateData} />}
            {step === 1 && <StepCms data={state.data} onChange={updateData} />}
            {step === 2 && <StepTools data={state.data} cmsType={state.data.cmsType} onToggle={updateTools} onChange={updateData} />}
            {step === 3 && <StepAutomation data={state.data} onChange={updateData} />}
            {step === 4 && <StepNotifications data={state.data} onChange={updateData} slackConnected={state.data.connectedTools.slack} />}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
          {!isFirst && (
            <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5">
              <ArrowLeft size={14} />
              Back
            </Button>
          )}
          <button
            onClick={handleNext}
            disabled={!canContinue() || submitting}
            className="rounded-full px-5 py-2 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:shadow-md disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #17C3B2, #2C6BED)' }}
          >
            {submitting ? 'Saving…' : isLast ? 'Get started' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
