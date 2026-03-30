"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Button,
} from "@leadsens/ui";
import { cn } from "@leadsens/ui";
import type { SeoAgentProfile, SeoCmsType, SeoAutomationLevel, SeoGeoLevel, SeoAlertChannel } from "@/agents/seo-geo/types";
import type { OnboardingState, OnboardingQuestion } from "@/agents/seo-geo/onboarding";

// ─── Types ────────────────────────────────────────────────

export interface SeoOnboardingModalProps {
  open: boolean;
  onComplete: (profile: SeoAgentProfile) => void;
  onClose: () => void;
}

type StepInputs = {
  siteUrl: string;
  cms: string;
  gscConnected: boolean;
  gaConnected: boolean;
  automationLevel: string;
  geoLevel: string;
  geoDetails: string;
  priorityPages: string;
  alertSlack: boolean;
  alertEmail: boolean;
  alertReport: boolean;
  wpSiteUrl: string;
  wpUsername: string;
  wpAppPassword: string;
};

const EMPTY_INPUTS: StepInputs = {
  siteUrl: '',
  cms: '',
  gscConnected: false,
  gaConnected: false,
  automationLevel: '',
  geoLevel: '',
  geoDetails: '',
  priorityPages: '',
  alertSlack: false,
  alertEmail: false,
  alertReport: true,
  wpSiteUrl: '',
  wpUsername: '',
  wpAppPassword: '',
};

const STEP_LABELS: Record<string, string> = {
  site_url: 'URL du site',
  cms: 'CMS',
  wordpress_credentials: 'WordPress',
  tools_connection: 'Connexion outils',
  automation_level: 'Automatisation',
  geo: 'Dimension GEO',
  priority_pages: 'Pages prioritaires',
  alert_channel: 'Alertes',
  confirmation: 'Confirmation',
};

function buildStepOrder(cms: string): string[] {
  const base = [
    'site_url', 'cms', 'tools_connection', 'automation_level',
    'geo', 'priority_pages', 'alert_channel', 'confirmation',
  ];
  if (cms.toLowerCase().includes('wordpress') || cms.toLowerCase().includes('wp')) {
    base.splice(2, 0, 'wordpress_credentials');
  }
  return base;
}

// ─── Helpers ──────────────────────────────────────────────

function GradientButton({
  onClick,
  disabled,
  children,
  className,
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-12 px-6 rounded-xl font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed",
        className,
      )}
      style={{ background: "var(--elevay-gradient-btn)" }}
    >
      {children}
    </button>
  );
}

function buildAnswer(step: string, inputs: StepInputs): string {
  switch (step) {
    case 'site_url':
      return inputs.siteUrl.trim();
    case 'cms':
      return inputs.cms;
    case 'tools_connection': {
      const parts: string[] = [];
      if (inputs.gscConnected) parts.push('gsc');
      if (inputs.gaConnected) parts.push('ga');
      return parts.length > 0 ? parts.join(' ') : 'aucun';
    }
    case 'automation_level':
      return inputs.automationLevel;
    case 'geo': {
      const base = inputs.geoLevel;
      const detail = inputs.geoDetails.trim();
      return detail ? `${base} ${detail}` : base;
    }
    case 'priority_pages':
      return inputs.priorityPages.trim() || 'je ne sais pas';
    case 'alert_channel': {
      const parts: string[] = [];
      if (inputs.alertSlack) parts.push('slack');
      if (inputs.alertEmail) parts.push('email');
      if (parts.length === 0) parts.push('rapport');
      return parts.join(' ');
    }
    case 'confirmation':
      return 'Oui';
    default:
      return '';
  }
}

function isStepValid(step: string, inputs: StepInputs): boolean {
  switch (step) {
    case 'site_url':
      try { new URL(inputs.siteUrl.trim()); return true; } catch { return false; }
    case 'cms':
      return inputs.cms !== '';
    case 'tools_connection':
      return true; // always valid (optional)
    case 'automation_level':
      return inputs.automationLevel !== '';
    case 'geo':
      return inputs.geoLevel !== '';
    case 'priority_pages':
      return true; // optional
    case 'alert_channel':
      return true; // report is default
    case 'wordpress_credentials':
      return true; // always optional — can skip
    case 'confirmation':
      return true;
    default:
      return false;
  }
}

// ─── Component ────────────────────────────────────────────

type HistoryEntry = { state: OnboardingState; question: OnboardingQuestion; inputs: StepInputs };

export function SeoOnboardingModal({ open, onComplete, onClose }: SeoOnboardingModalProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentState, setCurrentState] = useState<OnboardingState | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<OnboardingQuestion | null>(null);
  const [inputs, setInputs] = useState<StepInputs>(EMPTY_INPUTS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Client-only step overlay — 'wordpress_credentials' is not an API step
  const [localOverrideStep, setLocalOverrideStep] = useState<'wordpress_credentials' | null>(null);

  // ─── Start on open ────────────────────────────────────

  const start = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setHistory([]);
    setInputs(EMPTY_INPUTS);
    try {
      const res = await fetch('/api/agents/seo-geo/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      if (!res.ok) throw new Error('Erreur de démarrage');
      const data = await res.json() as { state: OnboardingState; question: OnboardingQuestion };
      setCurrentState(data.state);
      setCurrentQuestion(data.question);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void start();
  }, [open, start]);

  // ─── Answer handler ───────────────────────────────────

  const handleNext = useCallback(async (skipAnswer?: string) => {
    if (isLoading) return;

    // wordpress_credentials is client-only — just clear the override and advance
    if (localOverrideStep === 'wordpress_credentials') {
      setLocalOverrideStep(null);
      return;
    }

    if (!currentState || !currentQuestion) return;

    const answer = skipAnswer ?? buildAnswer(currentState.currentStep, inputs);

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/agents/seo-geo/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'answer', state: currentState, answer }),
      });
      if (!res.ok) throw new Error('Erreur de traitement');

      const data = await res.json() as
        | { state: OnboardingState; question: OnboardingQuestion; complete: false }
        | { state: OnboardingState; complete: true; result: { profile: { siteUrl: string; cmsType: string; automationLevel: string; geoLevel: string; targetGeos: string[]; priorityPages: string[]; alertChannels: string[]; connectedTools: { gsc: boolean; ga: boolean; ahrefs: boolean; semrush: boolean } } } };

      if (data.complete) {
        const p = data.result.profile;
        const profile: SeoAgentProfile = {
          siteUrl: p.siteUrl,
          cmsType: p.cmsType as SeoCmsType,
          automationLevel: p.automationLevel as SeoAutomationLevel,
          geoLevel: p.geoLevel as SeoGeoLevel,
          targetGeos: p.targetGeos,
          priorityPages: p.priorityPages,
          alertChannels: p.alertChannels as SeoAlertChannel[],
          connectedTools: p.connectedTools,
          wordpressCredentials:
            inputs.wpSiteUrl && inputs.wpUsername && inputs.wpAppPassword
              ? {
                  siteUrl: inputs.wpSiteUrl,
                  username: inputs.wpUsername,
                  applicationPassword: inputs.wpAppPassword,
                }
              : undefined,
        };
        localStorage.setItem('elevay_seo_profile', JSON.stringify(profile));
        onComplete(profile);
      } else {
        setHistory((prev) => [...prev, { state: currentState, question: currentQuestion, inputs }]);
        setCurrentState(data.state);
        setCurrentQuestion(data.question);
        // Insert client-only wordpress_credentials step before tools_connection for WP users
        if (data.state.currentStep === 'tools_connection' && inputs.cms.toLowerCase() === 'wordpress') {
          setLocalOverrideStep('wordpress_credentials');
        }
        setInputs(EMPTY_INPUTS);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue');
    } finally {
      setIsLoading(false);
    }
  }, [currentState, currentQuestion, inputs, isLoading, localOverrideStep, onComplete]);

  // ─── Back handler ─────────────────────────────────────

  const handleBack = useCallback(() => {
    if (localOverrideStep === 'wordpress_credentials') {
      // Go back to cms — pop the history entry we pushed when entering wp step
      const prev = history[history.length - 1];
      if (!prev) return;
      setHistory((h) => h.slice(0, -1));
      setCurrentState(prev.state);
      setCurrentQuestion(prev.question);
      setInputs(prev.inputs);
      setLocalOverrideStep(null);
      setError(null);
      return;
    }
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setCurrentState(prev.state);
    setCurrentQuestion(prev.question);
    setInputs(prev.inputs);
    setError(null);
  }, [history, localOverrideStep]);

  // ─── Derived ──────────────────────────────────────────

  const stepOrder = buildStepOrder(inputs.cms);
  const TOTAL_STEPS = stepOrder.length;
  const currentStep: string = localOverrideStep ?? (currentState?.currentStep ?? 'site_url');
  const stepIndex = stepOrder.indexOf(currentStep);
  const stepNumber = stepIndex + 1;
  const stepLabel = STEP_LABELS[currentStep] ?? '';
  const canGoBack = history.length > 0;
  const isRequired = currentQuestion?.required ?? true;
  const canProceed = isStepValid(currentStep, inputs);

  // ─── Step content ─────────────────────────────────────

  function renderStepContent() {
    if (!currentQuestion) return null;

    switch (currentStep) {
      case 'site_url':
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{currentQuestion.message}</p>
            <Input
              type="url"
              placeholder="https://monsite.fr"
              value={inputs.siteUrl}
              onChange={(e) => setInputs((p) => ({ ...p, siteUrl: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter' && canProceed) void handleNext(); }}
              autoFocus
            />
          </div>
        );

      case 'cms':
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{currentQuestion.message}</p>
            <div className="grid grid-cols-2 gap-2">
              {(['wordpress', 'hubspot', 'shopify', 'webflow', 'other'] as const).map((cms) => (
                <button
                  key={cms}
                  type="button"
                  onClick={() => setInputs((p) => ({ ...p, cms }))}
                  className={cn(
                    "px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150 capitalize",
                    inputs.cms === cms
                      ? "border-primary text-primary bg-primary/5"
                      : "border-border text-foreground/70 hover:border-primary/50",
                    cms === 'other' && 'col-span-2',
                  )}
                >
                  {cms === 'other' ? 'Autre CMS' : cms.charAt(0).toUpperCase() + cms.slice(1)}
                </button>
              ))}
            </div>
          </div>
        );

      case 'wordpress_credentials':
        return (
          <div className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Connectez WordPress pour injecter metas, ALT texts et redirections directement.
              <span className="block mt-1 font-medium" style={{ color: '#17c3b2' }}>
                Optionnel — cliquez sur Passer pour continuer sans connecter.
              </span>
            </p>
            <input
              type="url"
              placeholder="https://monsite.fr"
              value={inputs.wpSiteUrl}
              onChange={(e) => setInputs((p) => ({ ...p, wpSiteUrl: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
            <input
              type="text"
              placeholder="Nom d'utilisateur WordPress"
              value={inputs.wpUsername}
              onChange={(e) => setInputs((p) => ({ ...p, wpUsername: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
            <input
              type="password"
              placeholder="Application Password (WP Admin → Utilisateurs → Profil)"
              value={inputs.wpAppPassword}
              onChange={(e) => setInputs((p) => ({ ...p, wpAppPassword: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Générez un Application Password depuis WP Admin → Utilisateurs → Profil → Application Passwords
            </p>
          </div>
        );

      case 'tools_connection':
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{currentQuestion.message}</p>
            <div className="space-y-2">
              {([
                { key: 'gscConnected' as const, label: 'Google Search Console', desc: 'Positions, clics, impressions' },
                { key: 'gaConnected' as const, label: 'Google Analytics', desc: 'Trafic, sessions, conversions' },
              ]).map(({ key, label, desc }) => (
                <label
                  key={key}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150",
                    inputs[key] ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={inputs[key]}
                    onChange={(e) => setInputs((p) => ({ ...p, [key]: e.target.checked }))}
                    className="mt-0.5 accent-[#17c3b2]"
                  />
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        );

      case 'automation_level':
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-xs whitespace-pre-line">{currentQuestion.message}</p>
            <div className="space-y-2">
              {([
                { value: 'audit', label: 'Audit seul', desc: 'Rapports uniquement, vous exécutez' },
                { value: 'semi-auto', label: 'Semi-auto', desc: 'Corrections sans risque auto, validation pour le reste' },
                { value: 'full-auto', label: 'Full auto', desc: 'Tout automatique selon les règles configurées' },
              ]).map(({ value, label, desc }) => (
                <label
                  key={value}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150",
                    inputs.automationLevel === value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                  )}
                >
                  <input
                    type="radio"
                    name="automation"
                    value={value}
                    checked={inputs.automationLevel === value}
                    onChange={() => setInputs((p) => ({ ...p, automationLevel: value }))}
                    className="mt-0.5 accent-[#17c3b2]"
                  />
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        );

      case 'geo':
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{currentQuestion.message.split('\n')[0]}</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'national', label: '🌍 National' },
                { value: 'regional', label: '📍 Régional' },
                { value: 'city', label: '🏙️ Local' },
                { value: 'multi-geo', label: '🌐 Multi-pays' },
              ]).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setInputs((p) => ({ ...p, geoLevel: value }))}
                  className={cn(
                    "px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150",
                    inputs.geoLevel === value
                      ? "border-primary text-primary bg-primary/5"
                      : "border-border text-foreground/70 hover:border-primary/50",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {inputs.geoLevel && inputs.geoLevel !== 'national' && (
              <Input
                placeholder={
                  inputs.geoLevel === 'regional' ? "ex : Île-de-France"
                  : inputs.geoLevel === 'city' ? "ex : Paris, Lyon, Marseille"
                  : "ex : FR, BE, CH"
                }
                value={inputs.geoDetails}
                onChange={(e) => setInputs((p) => ({ ...p, geoDetails: e.target.value }))}
                className="mt-1"
              />
            )}
          </div>
        );

      case 'priority_pages':
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{currentQuestion.message}</p>
            <textarea
              className="w-full min-h-[100px] px-3 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              placeholder={"/ma-page-1\nhttps://monsite.fr/produit\n…"}
              value={inputs.priorityPages}
              onChange={(e) => setInputs((p) => ({ ...p, priorityPages: e.target.value }))}
            />
          </div>
        );

      case 'alert_channel':
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{currentQuestion.message}</p>
            <div className="space-y-2">
              {([
                { key: 'alertSlack' as const, label: 'Slack', desc: 'Notifications en temps réel dans votre workspace' },
                { key: 'alertEmail' as const, label: 'Email', desc: 'Récapitulatif hebdomadaire par email' },
              ]).map(({ key, label, desc }) => (
                <label
                  key={key}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150",
                    inputs[key] ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={inputs[key]}
                    onChange={(e) => setInputs((p) => ({ ...p, [key]: e.target.checked }))}
                    className="mt-0.5 accent-[#17c3b2]"
                  />
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                </label>
              ))}
              <label className={cn(
                "flex items-start gap-3 p-3 rounded-xl border",
                "border-border bg-muted/30",
              )}>
                <input type="checkbox" checked disabled className="mt-0.5 accent-[#17c3b2]" />
                <div>
                  <div className="text-sm font-medium text-foreground/50">Rapport hebdomadaire</div>
                  <div className="text-xs text-muted-foreground">Toujours activé — rapport dans l&apos;app</div>
                </div>
              </label>
            </div>
          </div>
        );

      case 'confirmation':
        return (
          <div className="space-y-3">
            <div className="rounded-xl bg-muted/50 border border-border p-4 text-sm whitespace-pre-line text-foreground/80 leading-relaxed">
              {currentQuestion.message}
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  // ─── Render ───────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={() => { /* blocked — no close without completion */ }}>
      <DialogContent
        className="max-w-[520px] p-8 max-h-[90vh] overflow-y-auto pb-6"
        showCloseButton={false}
      >
        {/* Logo */}
        <div className="flex justify-center mb-2">
          <img src="/logo-elevay.svg" alt="Elevay" className="h-10" />
        </div>

        {/* Header */}
        <DialogHeader className="text-center mb-2">
          <DialogTitle className="text-xl font-semibold text-center">
            {stepLabel}
          </DialogTitle>
          <p className="text-sm text-muted-foreground text-center">
            Configuration de votre espace SEO &amp; GEO.
          </p>
        </DialogHeader>

        {/* Gradient progress bar */}
        <div className="space-y-1 mb-6">
          <div className="flex justify-end">
            <span className="text-xs text-muted-foreground">
              Étape {stepNumber} sur {TOTAL_STEPS}
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${(stepNumber / TOTAL_STEPS) * 100}%`,
                background: "var(--elevay-gradient-btn)",
              }}
            />
          </div>
        </div>

        {/* Step content */}
        {isLoading && !currentQuestion ? (
          <div className="flex items-center justify-center py-12">
            <span className="size-6 border-2 border-primary border-r-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="min-h-[180px]">
            {renderStepContent()}
            {error && (
              <p className="text-xs text-destructive mt-3">{error}</p>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 gap-3">
          <div className="flex items-center gap-2">
            {canGoBack && (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isLoading}
                className="h-10 px-4 rounded-xl"
              >
                Retour
              </Button>
            )}
            {!canGoBack && (
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={isLoading}
                className="h-10 px-4 rounded-xl text-muted-foreground"
              >
                Fermer
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(!isRequired || currentStep === 'wordpress_credentials') && currentStep !== 'confirmation' && (
              <Button
                variant="ghost"
                onClick={() => void handleNext(currentQuestion?.skipLabel ? 'je ne sais pas' : '')}
                disabled={isLoading}
                className="h-10 px-4 rounded-xl text-muted-foreground text-sm"
              >
                {currentQuestion?.skipLabel ?? 'Passer'}
              </Button>
            )}
            {currentStep === 'confirmation' ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => void start()}
                  disabled={isLoading}
                  className="h-12 px-4 rounded-xl"
                >
                  Recommencer
                </Button>
                <GradientButton
                  onClick={() => void handleNext()}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 border-2 border-white/60 border-r-transparent rounded-full animate-spin" />
                      Enregistrement…
                    </span>
                  ) : 'Confirmer'}
                </GradientButton>
              </div>
            ) : (
              <GradientButton
                onClick={() => void handleNext()}
                disabled={isLoading || !canProceed}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 border-2 border-white/60 border-r-transparent rounded-full animate-spin" />
                    Chargement…
                  </span>
                ) : 'Suivant'}
              </GradientButton>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
