"use client";

import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useOnboarding } from "../onboarding-context";

const ROLE_OPTIONS = [
  { value: "founder_ceo", label: "Founder / CEO" },
  { value: "sales_leader", label: "Sales Leader" },
  { value: "sdr_bdr_ae", label: "SDR / BDR / AE" },
  { value: "growth", label: "Growth" },
  { value: "marketing", label: "Marketing" },
  { value: "revops", label: "RevOps" },
  { value: "agency", label: "Agency" },
  { value: "consultant", label: "Consultant" },
  { value: "recruiting", label: "Recruiting" },
  { value: "other", label: "Other" },
] as const;

const TEAM_SIZES = [
  { value: "solo", label: "Just me" },
  { value: "2-5", label: "2–5" },
  { value: "6-20", label: "6–20" },
  { value: "21-100", label: "21–100" },
  { value: "100+", label: "100+" },
] as const;

const PILL =
  "px-2.5 py-0.5 rounded-full text-xs border transition-all cursor-pointer";
const PILL_ON =
  "border-transparent bg-gradient-to-r from-[#17C3B2] via-[#2C6BED] to-[#FF7A3D] [background-size:120%_100%] [background-position:center] text-white shadow-sm shadow-[#2C6BED]/25";
const PILL_OFF =
  "border-border text-muted-foreground hover:border-teal-500/40 hover:text-foreground";

export function WelcomeStep() {
  const { state, setState, nextStep, setStepAction } = useOnboarding();

  const canContinue =
    state.companyName.trim().length > 0 &&
    state.senderRole.length > 0;

  useEffect(() => {
    setStepAction({
      label: "Continue",
      onClick: nextStep,
      disabled: !canContinue,
    });
  }, [canContinue, nextStep, setStepAction]);

  const isOther =
    state.senderRole === "other" || state.senderRole.startsWith("other:");

  return (
    <div>
      <div className="text-center">
        <h2 className="text-lg font-semibold">
          Welcome{state.userName ? `, ${state.userName}` : ""}
        </h2>
        <p className="text-xs text-muted-foreground">
          Let&apos;s set up your workspace
        </p>
      </div>

      <div className="space-y-2.5">
        <div className="space-y-1">
          <label htmlFor="ob-company" className="text-xs font-medium">
            Company name
          </label>
          <Input
            id="ob-company"
            placeholder="e.g. Acme Inc"
            className="h-7 text-sm shadow-none"
            style={{ borderColor: "oklch(0.85 0.004 286 / 40%)" }}
            spellCheck={false}
            value={state.companyName}
            onChange={(e) =>
              setState((prev) => ({ ...prev, companyName: e.target.value }))
            }
            autoFocus
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">Your role</label>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_OPTIONS.map((opt) => {
              const selected =
                opt.value === "other"
                  ? isOther
                  : state.senderRole === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`${PILL} ${selected ? PILL_ON : PILL_OFF}`}
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      senderRole:
                        prev.senderRole === opt.value ? "" : opt.value,
                    }))
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {isOther && (
            <Input
              placeholder="Your role"
              className="h-7 text-xs mt-0.5"
              value={
                state.senderRole.startsWith("other:")
                  ? state.senderRole.slice(6)
                  : ""
              }
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  senderRole: e.target.value
                    ? `other:${e.target.value}`
                    : "other",
                }))
              }
            />
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">Team size</label>
          <div className="flex gap-1.5">
            {TEAM_SIZES.map((size) => {
              const isSelected = state.teamSize === size.value;
              return (
                <button
                  key={size.value}
                  type="button"
                  className={`${PILL} ${isSelected ? PILL_ON : PILL_OFF}`}
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      teamSize: prev.teamSize === size.value ? "" : size.value,
                    }))
                  }
                >
                  {size.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
