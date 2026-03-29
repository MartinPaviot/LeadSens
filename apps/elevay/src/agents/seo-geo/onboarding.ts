// Thin adapter — delegates to core/onboarding/, adds nothing, removes nothing

export {
  createOnboardingState,
  getCurrentQuestion,
  applyAnswer,
  finalizeOnboarding,
} from '../../../core/onboarding/index';

export type {
  OnboardingState,
  OnboardingStep,
  OnboardingResult,
  OnboardingQuestion,
} from '../../../core/onboarding/types';
