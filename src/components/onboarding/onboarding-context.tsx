"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

export type AutonomyLevel = "MANUAL" | "SUPERVISED" | "AUTO";

export interface StepAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  secondary?: ReactNode;
}

export interface OnboardingState {
  userName: string;
  senderRole: string;
  companyName: string;
  companyUrl: string;
  isAnalyzingUrl: boolean;
  analysisComplete: boolean;
  analysisError: string | null;
  connectedEsp: string | null;
  connectedTools: string[];
  connectedCrm: string | null;
  teamSize: string;
  autonomyLevel: AutonomyLevel;
  currentStep: number;
  direction: "forward" | "backward";
}

interface OnboardingContextValue {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  totalSteps: number;
  stepAction: StepAction | null;
  setStepAction: (action: StepAction | null) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export const TOTAL_STEPS = 5;

const STORAGE_KEY = "leadsens-onboarding";

const DEFAULTS: OnboardingState = {
  userName: "",
  senderRole: "",
  companyName: "",
  companyUrl: "",
  isAnalyzingUrl: false,
  analysisComplete: false,
  analysisError: null,
  connectedEsp: null,
  connectedTools: [],
  connectedCrm: null,
  teamSize: "",
  autonomyLevel: "SUPERVISED",
  currentStep: 0,
  direction: "forward",
};

export function OnboardingProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: Partial<OnboardingState>;
}) {
  const [stepAction, setStepAction] = useState<StepAction | null>(null);

  const savedState =
    typeof window !== "undefined"
      ? (() => {
          try {
            return JSON.parse(
              localStorage.getItem(STORAGE_KEY) || "{}",
            ) as Partial<OnboardingState>;
          } catch {
            return {};
          }
        })()
      : {};

  const [state, setState] = useState<OnboardingState>({
    ...DEFAULTS,
    ...savedState,
    ...initialState,
    currentStep:
      initialState?.currentStep ?? savedState?.currentStep ?? 0,
    direction: "forward",
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable */
    }
  }, [state]);

  const nextStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, TOTAL_STEPS - 1),
      direction: "forward",
    }));
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 0),
      direction: "backward",
    }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(0, Math.min(step, TOTAL_STEPS - 1)),
      direction: step > prev.currentStep ? "forward" : "backward",
    }));
  }, []);

  return (
    <OnboardingContext.Provider
      value={{ state, setState, nextStep, prevStep, goToStep, totalSteps: TOTAL_STEPS, stepAction, setStepAction }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return ctx;
}
