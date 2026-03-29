import { ClientProfile } from '../types';

export type OnboardingStep =
  | 'site_url'
  | 'cms'
  | 'tools_connection'
  | 'automation_level'
  | 'geo'
  | 'priority_pages'
  | 'alert_channel'
  | 'confirmation';

export type OnboardingStatus = 'in_progress' | 'complete' | 'aborted';

export interface OnboardingState {
  sessionId: string;
  userId: string;
  agentFamily: string;
  currentStep: OnboardingStep;
  status: OnboardingStatus;
  collected: Partial<ClientProfile>;
  missingTools: string[];
  startedAt: Date;
  completedAt?: Date;
}

export interface OnboardingQuestion {
  step: OnboardingStep;
  message: string;
  required: boolean;
  skipLabel?: string;
}

export interface OnboardingResult {
  profile: ClientProfile;
  missingTools: string[];
  degradedCapabilities: string[];
}
