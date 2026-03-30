import { useState, useCallback, useEffect } from 'react';

export interface OnboardingData {
  siteUrl: string;
  language: string;
  sector: string;
  targetAudience: string;
  toneOfVoice: string;
  primaryCta: string;
  cmsType: 'wordpress' | 'hubspot' | 'shopify' | 'webflow' | 'none' | 'other';
  otherCms?: string;
  connectedTools: {
    gsc: boolean;
    ga: boolean;
    cms: boolean;
    googleDrive: boolean;
    googleDocs: boolean;
    slack: boolean;
    ahrefs: boolean;
    semrush: boolean;
  };
  automationLevel: 'audit' | 'semi-auto' | 'full-auto';
  alertChannel: 'email' | 'slack' | 'digest';
}

export interface OnboardingState {
  currentStep: number;
  data: OnboardingData;
}

const STORAGE_KEY = 'elevay_onboarding_state';

const DEFAULT_STATE: OnboardingState = {
  currentStep: 0,
  data: {
    siteUrl: '',
    language: 'en',
    sector: '',
    targetAudience: '',
    toneOfVoice: 'professional',
    primaryCta: '',
    cmsType: 'none',
    connectedTools: {
      gsc: false,
      ga: false,
      cms: false,
      googleDrive: false,
      googleDocs: false,
      slack: false,
      ahrefs: false,
      semrush: false,
    },
    automationLevel: 'semi-auto',
    alertChannel: 'email',
  },
};

function loadState(): OnboardingState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return JSON.parse(raw) as OnboardingState;
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(state: OnboardingState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

export function clearOnboardingState(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function useOnboardingStore() {
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);

  // Load from localStorage on mount
  useEffect(() => {
    setState(loadState());
  }, []);

  const setStep = useCallback((step: number) => {
    setState((prev) => {
      const next = { ...prev, currentStep: step };
      saveState(next);
      return next;
    });
  }, []);

  const updateData = useCallback((partial: Partial<OnboardingData>) => {
    setState((prev) => {
      const next = { ...prev, data: { ...prev.data, ...partial } };
      saveState(next);
      return next;
    });
  }, []);

  const updateTools = useCallback((partial: Partial<OnboardingData['connectedTools']>) => {
    setState((prev) => {
      const next = {
        ...prev,
        data: {
          ...prev.data,
          connectedTools: { ...prev.data.connectedTools, ...partial },
        },
      };
      saveState(next);
      return next;
    });
  }, []);

  return { state, setStep, updateData, updateTools };
}
