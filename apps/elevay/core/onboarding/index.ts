import { OnboardingState, OnboardingStep, OnboardingResult, OnboardingQuestion } from './types';
import { ONBOARDING_QUESTIONS } from './questions';
import { ClientProfile, AutomationLevel, CmsType, GeoLevel, AlertChannel } from '../types';

const STEP_ORDER: OnboardingStep[] = [
  'site_url',
  'cms',
  'tools_connection',
  'automation_level',
  'geo',
  'priority_pages',
  'alert_channel',
  'confirmation',
];

export function createOnboardingState(
  userId: string,
  agentFamily: string,
): OnboardingState {
  return {
    sessionId: crypto.randomUUID(),
    userId,
    agentFamily,
    currentStep: 'site_url',
    status: 'in_progress',
    collected: {},
    missingTools: [],
    startedAt: new Date(),
  };
}

export function getCurrentQuestion(state: OnboardingState): OnboardingQuestion {
  const q = ONBOARDING_QUESTIONS[state.currentStep];
  if (state.currentStep === 'confirmation') {
    return {
      ...q,
      message: buildConfirmationMessage(state),
    };
  }
  return q;
}

export function applyAnswer(
  state: OnboardingState,
  answer: string,
): OnboardingState {
  const next = { ...state, collected: { ...state.collected } };

  switch (state.currentStep) {
    case 'site_url':
      next.collected.siteUrl = answer.trim();
      break;
    case 'cms':
      next.collected.cmsType = parseCmsType(answer);
      break;
    case 'tools_connection':
      next.missingTools = parseToolsConnection(answer);
      break;
    case 'automation_level':
      next.collected.automationLevel = parseAutomationLevel(answer);
      break;
    case 'geo': {
      const { geoLevel, targetGeos } = parseGeo(answer);
      next.collected.geoLevel = geoLevel;
      next.collected.targetGeos = targetGeos;
      break;
    }
    case 'priority_pages':
      next.collected.priorityPages = parsePriorityPages(answer);
      break;
    case 'alert_channel':
      next.collected.alertChannels = parseAlertChannels(answer);
      break;
    case 'confirmation':
      if (answer.toLowerCase().startsWith('o')) {
        next.status = 'complete';
        next.completedAt = new Date();
      }
      break;
  }

  if (next.status !== 'complete') {
    next.currentStep = getNextStep(state.currentStep);
  }

  return next;
}

export function finalizeOnboarding(state: OnboardingState): OnboardingResult {
  const profile: ClientProfile = {
    id: state.sessionId,
    siteUrl: state.collected.siteUrl ?? '',
    cmsType: state.collected.cmsType ?? 'other',
    automationLevel: state.collected.automationLevel ?? 'audit',
    geoLevel: state.collected.geoLevel ?? 'national',
    targetGeos: state.collected.targetGeos ?? [],
    priorityPages: state.collected.priorityPages ?? [],
    alertChannels: state.collected.alertChannels ?? ['report'],
    connectedTools: {
      gsc: !state.missingTools.includes('gsc'),
      ga: !state.missingTools.includes('ga'),
      ahrefs: !state.missingTools.includes('ahrefs'),
      semrush: !state.missingTools.includes('semrush'),
    },
  };

  const degradedCapabilities = buildDegradedCapabilities(state.missingTools);

  return { profile, missingTools: state.missingTools, degradedCapabilities };
}

// — parsers —

function parseCmsType(answer: string): CmsType {
  const a = answer.toLowerCase();
  if (a.includes('wordpress') || a.includes('wp')) return 'wordpress';
  if (a.includes('hubspot')) return 'hubspot';
  if (a.includes('shopify')) return 'shopify';
  if (a.includes('webflow')) return 'webflow';
  return 'other';
}

function parseAutomationLevel(answer: string): AutomationLevel {
  const a = answer.toLowerCase();
  if (a.includes('full') || a.includes('auto')) return 'full-auto';
  if (a.includes('semi')) return 'semi-auto';
  return 'audit';
}

function parseGeo(answer: string): { geoLevel: GeoLevel; targetGeos: string[] } {
  const a = answer.toLowerCase();
  if (a.includes('multi') || a.includes('pays') || a.includes('international')) {
    return { geoLevel: 'multi-geo', targetGeos: extractGeoTokens(answer) };
  }
  if (a.includes('local') || a.includes('ville')) {
    return { geoLevel: 'city', targetGeos: extractGeoTokens(answer) };
  }
  if (a.includes('région') || a.includes('region')) {
    return { geoLevel: 'regional', targetGeos: extractGeoTokens(answer) };
  }
  return { geoLevel: 'national', targetGeos: extractGeoTokens(answer) };
}

function extractGeoTokens(answer: string): string[] {
  return answer
    .split(/[,+\/\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

function parsePriorityPages(answer: string): string[] {
  if (answer.toLowerCase().includes('sais pas') || answer.toLowerCase().includes('passer')) {
    return [];
  }
  return answer
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.startsWith('http') || s.startsWith('/'));
}

function parseAlertChannels(answer: string): AlertChannel[] {
  const a = answer.toLowerCase();
  const channels: AlertChannel[] = [];
  if (a.includes('slack')) channels.push('slack');
  if (a.includes('email') || a.includes('mail')) channels.push('email');
  if (channels.length === 0) channels.push('report');
  return channels;
}

function parseToolsConnection(answer: string): string[] {
  const missing: string[] = [];
  const a = answer.toLowerCase();
  if (!a.includes('gsc') && !a.includes('search console')) missing.push('gsc');
  if (!a.includes('ga') && !a.includes('analytics')) missing.push('ga');
  return missing;
}

function getNextStep(current: OnboardingStep): OnboardingStep {
  const idx = STEP_ORDER.indexOf(current);
  return STEP_ORDER[Math.min(idx + 1, STEP_ORDER.length - 1)];
}

function buildConfirmationMessage(state: OnboardingState): string {
  const c = state.collected;
  const lines = [
    '✅ Récapitulatif de votre configuration :',
    `• Site : ${c.siteUrl ?? '—'}`,
    `• CMS : ${c.cmsType ?? '—'}`,
    `• Automatisation : ${c.automationLevel ?? '—'}`,
    `• GEO : ${c.geoLevel ?? '—'} — ${(c.targetGeos ?? []).join(', ') || '—'}`,
    `• Pages prioritaires : ${(c.priorityPages ?? []).length > 0 ? (c.priorityPages ?? []).join(', ') : 'non renseignées'}`,
    `• Alertes : ${(c.alertChannels ?? []).join(', ')}`,
  ];
  if (state.missingTools.length > 0) {
    lines.push(`⚠️ Outils non connectés : ${state.missingTools.join(', ')} — fonctionnement en mode dégradé`);
  }
  lines.push('\nConfirmez-vous ? (Oui / Non)');
  return lines.join('\n');
}

function buildDegradedCapabilities(missingTools: string[]): string[] {
  const map: Record<string, string> = {
    gsc: 'Ranking et indexation via DataForSEO uniquement — données trafic non disponibles',
    ga: 'Priorisation par ranking seul — comportement utilisateur non disponible',
    ahrefs: 'Analyse backlinks non disponible — autorité domaine estimée',
    semrush: 'Benchmark concurrent limité à SerpAPI',
  };
  return missingTools.map((t) => map[t]).filter((s): s is string => s !== undefined);
}

export * from './types';
export * from './questions';
