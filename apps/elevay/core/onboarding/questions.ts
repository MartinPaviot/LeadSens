import { OnboardingQuestion, OnboardingStep } from './types';

export const ONBOARDING_QUESTIONS: Record<OnboardingStep, OnboardingQuestion> = {
  site_url: {
    step: 'site_url',
    message: "Quelle est l'URL de votre site ? (ex: https://monsite.fr)",
    required: true,
  },
  cms: {
    step: 'cms',
    message: 'Quel CMS utilisez-vous ? WordPress / HubSpot / Shopify / Webflow / Autre',
    required: true,
  },
  tools_connection: {
    step: 'tools_connection',
    message:
      'Connectez vos outils pour des résultats optimaux : Google Search Console, Google Analytics. (Recommandé — vous pouvez passer cette étape)',
    required: false,
    skipLabel: 'Passer — je connecterai plus tard',
  },
  automation_level: {
    step: 'automation_level',
    message:
      "Niveau d'automatisation souhaité ?\n• Audit seul — rapports uniquement, vous exécutez\n• Semi-auto — corrections sans risque automatiques, validation pour le reste\n• Full auto — tout automatique selon les règles configurées",
    required: true,
  },
  geo: {
    step: 'geo',
    message:
      'Quelle est votre dimension géographique ?\n• National (ex: France)\n• Régional (ex: Île-de-France)\n• Local (ex: Paris, Lyon)\n• Multi-pays (ex: FR + BE + CH)',
    required: true,
  },
  priority_pages: {
    step: 'priority_pages',
    message:
      'Quelles sont vos pages prioritaires ? (top trafic ou top conversion — listez les URLs ou dites "je ne sais pas")',
    required: false,
    skipLabel: 'Je ne sais pas encore',
  },
  alert_channel: {
    step: 'alert_channel',
    message: 'Comment souhaitez-vous recevoir les alertes ? Slack / Email / Rapport hebdo uniquement',
    required: true,
  },
  confirmation: {
    step: 'confirmation',
    message: '', // generated dynamically from collected data
    required: true,
  },
};
