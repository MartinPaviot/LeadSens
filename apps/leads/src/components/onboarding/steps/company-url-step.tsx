"use client";

import { useState, useCallback, useEffect } from "react";
import { Input } from "@leadsens/ui";
import { Spinner, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { useOnboarding } from "../onboarding-context";

export function CompanyUrlStep() {
  const { state, setState, nextStep, setStepAction } = useOnboarding();
  const [urlInput, setUrlInput] = useState(state.companyUrl);

  const analyzeUrl = useCallback(async () => {
    let url = urlInput.trim();
    if (!url) return;

    if (!/^https?:\/\//.test(url)) {
      url = `https://${url}`;
      setUrlInput(url);
    }

    setState((prev) => ({
      ...prev,
      companyUrl: url,
      isAnalyzingUrl: true,
      analysisComplete: false,
      analysisError: null,
    }));

    try {
      const res = await fetch("/api/trpc/workspace.analyzeUrl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (res.ok) {
        setState((prev) => ({ ...prev, isAnalyzingUrl: false, analysisComplete: true }));
      } else {
        setState((prev) => ({ ...prev, isAnalyzingUrl: false, analysisError: "Could not analyze website" }));
      }
    } catch {
      setState((prev) => ({ ...prev, isAnalyzingUrl: false, analysisError: "Network error — try again later" }));
    }
  }, [urlInput, setState]);

  const handleSubmit = useCallback(() => {
    if (urlInput.trim() && !state.isAnalyzingUrl && !state.analysisComplete) {
      analyzeUrl();
    }
    if (urlInput.trim()) {
      nextStep();
    }
  }, [urlInput, state.isAnalyzingUrl, state.analysisComplete, analyzeUrl, nextStep]);

  const buttonLabel = state.isAnalyzingUrl
    ? "Continue while we analyze"
    : state.analysisComplete
      ? "Continue"
      : "Analyze & Continue";

  useEffect(() => {
    setStepAction({
      label: buttonLabel,
      onClick: handleSubmit,
      disabled: !urlInput.trim(),
      secondary: (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={nextStep}
        >
          I&apos;ll add this later
        </button>
      ),
    });
  }, [buttonLabel, handleSubmit, urlInput, nextStep, setStepAction]);

  return (
    <div>
      <div className="text-center">
        <h2 className="text-lg font-semibold">Your company website</h2>
        <p className="text-xs text-muted-foreground">
          We&apos;ll analyze it to understand your product and build better emails
        </p>
      </div>

      <div className="space-y-2.5 pt-4">
        <div className="flex gap-2">
          <Input
            placeholder="yourcompany.com"
            className="h-8"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            autoFocus
          />
          {!state.analysisComplete && !state.isAnalyzingUrl && (
            <button
              type="button"
              className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50"
              onClick={analyzeUrl}
              disabled={!urlInput.trim()}
            >
              Analyze
            </button>
          )}
        </div>

        {state.isAnalyzingUrl && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner className="size-3.5 animate-spin" />
            Analyzing your website...
          </div>
        )}
        {state.analysisComplete && (
          <div className="flex items-center gap-2 text-xs text-green-600">
            <CheckCircle className="size-3.5" weight="fill" />
            Website analyzed successfully
          </div>
        )}
        {state.analysisError && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <WarningCircle className="size-3.5" weight="fill" />
            {state.analysisError}
          </div>
        )}
      </div>
    </div>
  );
}
