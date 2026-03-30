"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
import { Button } from "@leadsens/ui";
import { toast } from "sonner";
import { useOnboardingStore, clearOnboardingState } from "@/lib/onboarding-store";
import { StepBusiness } from "./steps/step-business";
import { StepCms } from "./steps/step-cms";
import { StepTools } from "./steps/step-tools";
import { StepAutomation } from "./steps/step-automation";
import { StepNotifications } from "./steps/step-notifications";

const STEPS = [
  { id: 'business', label: 'Business', title: 'Your business', description: 'Tell us about your website so we can tailor the SEO strategy.' },
  { id: 'cms', label: 'CMS', title: 'Your CMS', description: 'Select your content management system for direct draft creation.' },
  { id: 'tools', label: 'Tools', title: 'Connect tools', description: 'Connect your SEO tools for richer insights and automation.' },
  { id: 'automation', label: 'Automation', title: 'Automation level', description: 'Choose how much control you want over changes.' },
  { id: 'notifications', label: 'Alerts', title: 'Notifications', description: 'How do you want to be notified when content is ready?' },
];

export function OnboardingShell() {
  const router = useRouter();
  const { state, setStep, updateData, updateTools } = useOnboardingStore();
  const [submitting, setSubmitting] = useState(false);

  const step = state.currentStep;
  const totalSteps = STEPS.length;
  const progress = ((step + 1) / totalSteps) * 100;
  const isLast = step === totalSteps - 1;
  const isFirst = step === 0;

  const canContinue = useCallback(() => {
    const d = state.data;
    switch (step) {
      case 0: return d.siteUrl.length > 0;
      default: return true;
    }
  }, [step, state.data]);

  const handleNext = useCallback(async () => {
    if (isLast) {
      // Submit
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
        router.push('/dashboard');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setSubmitting(false);
      }
    } else {
      setStep(step + 1);
    }
  }, [isLast, step, state.data, setStep, router]);

  const handleBack = useCallback(() => {
    if (!isFirst) setStep(step - 1);
  }, [isFirst, step, setStep]);

  const handleStepClick = useCallback((idx: number) => {
    // Only allow navigating to completed steps or the current step
    if (idx <= step) setStep(idx);
  }, [step, setStep]);

  const currentStep = STEPS[step];

  return (
    <div className="relative flex h-screen flex-col" style={{ background: 'radial-gradient(ellipse at 70% 20%, rgba(23,195,178,0.05), transparent 60%)' }}>
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, #17C3B2, #2C6BED)' }}>
            <span className="text-xs font-bold text-white">E</span>
          </div>
          <span className="text-sm font-semibold text-foreground">Elevay</span>
        </div>
        <span className="text-xs text-muted-foreground">
          Step {step + 1} of {totalSteps}
        </span>
      </div>

      {/* ── Progress bar ──────────────────────────────────── */}
      <div className="h-[2px] w-full bg-muted">
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #17C3B2, #2C6BED)',
          }}
        />
      </div>

      {/* ── Content area ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-[560px]">
          {/* Step watermark */}
          <div
            className="select-none text-foreground/[0.04]"
            style={{ fontSize: 64, fontWeight: 500, letterSpacing: '-0.04em', lineHeight: 1 }}
          >
            {step + 1}
          </div>

          {/* Title + description */}
          <h1
            className="mt-1 text-foreground"
            style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.03em' }}
          >
            {currentStep.title}
          </h1>
          <p className="mt-1.5 max-w-[420px] text-xs leading-relaxed text-muted-foreground">
            {currentStep.description}
          </p>

          {/* Form content */}
          <div className="mt-6">
            {step === 0 && <StepBusiness data={state.data} onChange={updateData} />}
            {step === 1 && <StepCms data={state.data} onChange={updateData} />}
            {step === 2 && <StepTools data={state.data} cmsType={state.data.cmsType} onToggle={updateTools} />}
            {step === 3 && <StepAutomation data={state.data} onChange={updateData} />}
            {step === 4 && <StepNotifications data={state.data} onChange={updateData} slackConnected={state.data.connectedTools.slack} />}
          </div>
        </div>
      </div>

      {/* ── Bottom bar ────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-3">
        {/* Step tabs — hidden on mobile */}
        <div className="hidden items-center gap-4 sm:flex">
          {STEPS.map((s, i) => {
            const isDone = i < step;
            const isActive = i === step;
            return (
              <button
                key={s.id}
                onClick={() => handleStepClick(i)}
                disabled={i > step}
                className="text-xs font-medium transition-colors disabled:cursor-default"
                style={{
                  color: isActive ? '#17C3B2' : isDone ? 'var(--muted-foreground)' : 'var(--muted-foreground)',
                  opacity: i > step ? 0.4 : 1,
                  borderBottom: isActive ? '1.5px solid #17C3B2' : '1.5px solid transparent',
                  paddingBottom: 2,
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Mobile: step counter */}
        <span className="text-xs text-muted-foreground sm:hidden">
          Step {step + 1} of {totalSteps}
        </span>

        {/* Nav buttons */}
        <div className="flex items-center gap-2">
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
