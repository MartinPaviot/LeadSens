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
  otherCmsName: string;
  gscConnected: boolean;
  gaConnected: boolean;
  ahrefsConnected: boolean;
  semrushConnected: boolean;
  slackConnected: boolean;
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
  otherCmsName: '',
  gscConnected: false,
  gaConnected: false,
  ahrefsConnected: false,
  semrushConnected: false,
  slackConnected: false,
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
  site_url: 'Website URL',
  cms: 'CMS',
  wordpress_credentials: 'WordPress',
  tools_connection: 'Connect tools',
  automation_level: 'Automation',
  geo: 'Geographic scope',
  priority_pages: 'Priority pages',
  alert_channel: 'Alerts',
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
      if (inputs.ahrefsConnected) parts.push('ahrefs');
      if (inputs.semrushConnected) parts.push('semrush');
      if (inputs.slackConnected) parts.push('slack');
      return parts.length > 0 ? parts.join(' ') : 'none';
    }
    case 'automation_level':
      return inputs.automationLevel;
    case 'geo': {
      const base = inputs.geoLevel;
      const detail = inputs.geoDetails.trim();
      return detail ? `${base} ${detail}` : base;
    }
    case 'priority_pages':
      return inputs.priorityPages.trim() || 'not sure yet';
    case 'alert_channel': {
      const parts: string[] = [];
      if (inputs.alertSlack) parts.push('slack');
      if (inputs.alertEmail) parts.push('email');
      if (parts.length === 0) parts.push('report');
      return parts.join(' ');
    }
    case 'confirmation':
      return 'Yes';
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

// ─── OAuth helpers ────────────────────────────────────────

type OAuthPlatform = 'gsc' | 'ga' | 'ahrefs' | 'semrush' | 'slack';

const OAUTH_API_MAP: Record<OAuthPlatform, string> = {
  gsc: 'gsc',
  ga: 'ga',
  ahrefs: 'ahrefs',
  semrush: 'semrush',
  slack: 'slack',
};

// ─── Component ────────────────────────────────────────────

type HistoryEntry = { state: OnboardingState; question: OnboardingQuestion; inputs: StepInputs };

export function SeoOnboardingModal({ open, onComplete, onClose }: SeoOnboardingModalProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentState, setCurrentState] = useState<OnboardingState | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<OnboardingQuestion | null>(null);
  const [inputs, setInputs] = useState<StepInputs>(EMPTY_INPUTS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
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
      if (!res.ok) throw new Error('Failed to start onboarding');
      const data = await res.json() as { state: OnboardingState; question: OnboardingQuestion };
      setCurrentState(data.state);
      setCurrentQuestion(data.question);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void start();
  }, [open, start]);

  // ─── OAuth connect handler ────────────────────────────

  const handleOAuthConnect = useCallback(async (platform: OAuthPlatform) => {
    setConnectingPlatform(platform);
    try {
      const apiPlatform = OAUTH_API_MAP[platform];
      const res = await fetch(`/api/auth/social/${apiPlatform}/connect`, { method: "POST" });
      if (!res.ok) {
        setConnectingPlatform(null);
        return;
      }
      const data = await res.json() as { redirectUrl?: string | null };
      if (!data.redirectUrl) {
        setConnectingPlatform(null);
        return;
      }

      const popup = window.open(data.redirectUrl, `connect-${platform}`, "width=600,height=700,popup=1");
      if (!popup) {
        setConnectingPlatform(null);
        return;
      }
      const openedPopup = popup;

      function cleanup() {
        window.removeEventListener("message", onMessage);
        clearInterval(closeWatcher);
        setConnectingPlatform(null);
      }

      function onMessage(e: MessageEvent<unknown>) {
        if (typeof e.data !== "object" || !e.data || !("type" in e.data)) return;
        const msg = e.data as { type: string; platform?: string };
        if (msg.type !== "SOCIAL_CONNECTED") return;
        const key = `${platform}Connected` as keyof StepInputs;
        setInputs((p) => ({ ...p, [key]: true }));
        cleanup();
        openedPopup.close();
      }

      const closeWatcher = setInterval(() => {
        if (openedPopup.closed) cleanup();
      }, 500);

      window.addEventListener("message", onMessage);
    } catch {
      setConnectingPlatform(null);
    }
  }, []);

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
      if (!res.ok) throw new Error('Processing error');

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
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setIsLoading(false);
    }
  }, [currentState, currentQuestion, inputs, isLoading, localOverrideStep, onComplete]);

  // ─── Back handler ─────────────────────────────────────

  const handleBack = useCallback(() => {
    if (localOverrideStep === 'wordpress_credentials') {
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
              placeholder="https://yoursite.com"
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(['wordpress', 'hubspot', 'shopify', 'webflow', 'none', 'other'] as const).map((cms) => (
                <button
                  key={cms}
                  type="button"
                  onClick={() => setInputs((p) => ({ ...p, cms, otherCmsName: cms === 'other' ? p.otherCmsName : '' }))}
                  className={cn(
                    "px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150 capitalize",
                    inputs.cms === cms
                      ? "border-primary text-primary bg-primary/5"
                      : "border-border text-foreground/70 hover:border-primary/50",
                  )}
                >
                  {cms === 'none' ? 'No CMS' : cms === 'other' ? 'Other' : cms.charAt(0).toUpperCase() + cms.slice(1)}
                </button>
              ))}
            </div>
            {inputs.cms === 'other' && (
              <div className="animate-fade-in-up">
                <Input
                  type="text"
                  value={inputs.otherCmsName}
                  onChange={(e) => setInputs((p) => ({ ...p, otherCmsName: e.target.value }))}
                  placeholder="Which CMS do you use?"
                  className="mt-2"
                />
              </div>
            )}
          </div>
        );

      case 'wordpress_credentials':
        return (
          <div className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Connect WordPress to inject metas, ALT texts, and redirections directly.
              <span className="block mt-1 font-medium" style={{ color: '#17c3b2' }}>
                Optional — click Skip to continue without connecting.
              </span>
            </p>
            <input
              type="url"
              placeholder="https://yoursite.com"
              value={inputs.wpSiteUrl}
              onChange={(e) => setInputs((p) => ({ ...p, wpSiteUrl: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
            <input
              type="text"
              placeholder="WordPress username"
              value={inputs.wpUsername}
              onChange={(e) => setInputs((p) => ({ ...p, wpUsername: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
            <input
              type="password"
              placeholder="Application Password (WP Admin → Users → Profile)"
              value={inputs.wpAppPassword}
              onChange={(e) => setInputs((p) => ({ ...p, wpAppPassword: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Generate an Application Password from WP Admin → Users → Profile → Application Passwords
            </p>
          </div>
        );

      case 'tools_connection':
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{currentQuestion.message}</p>
            <div className="space-y-2">
              {([
                { key: 'gscConnected' as const, platform: 'gsc' as OAuthPlatform, label: 'Google Search Console', desc: 'Rankings, clicks, impressions' },
                { key: 'gaConnected' as const, platform: 'ga' as OAuthPlatform, label: 'Google Analytics', desc: 'Traffic, sessions, conversions' },
                { key: 'ahrefsConnected' as const, platform: 'ahrefs' as OAuthPlatform, label: 'Ahrefs', desc: 'Backlink analysis, domain rating' },
                { key: 'semrushConnected' as const, platform: 'semrush' as OAuthPlatform, label: 'SEMrush', desc: 'Keyword research, competitor analysis' },
                { key: 'slackConnected' as const, platform: 'slack' as OAuthPlatform, label: 'Slack', desc: 'Real-time notifications in your workspace' },
              ]).map(({ key, platform, label, desc }) => {
                const connected = inputs[key];
                const connecting = connectingPlatform === platform;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (!connected && !connecting) void handleOAuthConnect(platform);
                    }}
                    disabled={connected || connecting}
                    className={cn(
                      "flex items-center gap-3 w-full p-3 rounded-xl border text-left transition-all duration-150",
                      connected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                      connecting && "opacity-70",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground">{desc}</div>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: connected ? 'rgba(23,195,178,0.1)' : 'var(--muted)',
                        color: connected ? '#17C3B2' : 'var(--muted-foreground)',
                      }}
                    >
                      {connecting ? 'Connecting…' : connected ? 'Connected' : 'Connect'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'automation_level':
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{currentQuestion.message}</p>
            <div className="space-y-2">
              {([
                { value: 'audit', label: 'Audit only', desc: 'Reports only — you decide what to apply and do it yourself.' },
                { value: 'semi-auto', label: 'Semi-automatic', desc: 'Elevay applies nothing without your approval. Every correction and draft is shown to you first.' },
                { value: 'full-auto', label: 'Full automatic', desc: 'Elevay silently fixes technical issues (broken metas, missing alt texts, canonicals). You only approve content before publishing.' },
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {([
                { value: 'national', label: 'National' },
                { value: 'regional', label: 'Regional' },
                { value: 'city', label: 'Local / City' },
                { value: 'multi-geo', label: 'Multi-country' },
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
                  inputs.geoLevel === 'regional' ? "e.g. California, Ile-de-France"
                  : inputs.geoLevel === 'city' ? "e.g. Paris, London, New York"
                  : "e.g. US, UK, FR"
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
              placeholder={"/my-page\nhttps://yoursite.com/product\n…"}
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
                { key: 'alertSlack' as const, label: 'Slack', desc: 'Real-time notifications in your workspace' },
                { key: 'alertEmail' as const, label: 'Email', desc: 'Weekly summary sent to your email' },
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
                  <div className="text-sm font-medium text-foreground/50">Weekly report</div>
                  <div className="text-xs text-muted-foreground">Always enabled — report available in-app</div>
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
        className="p-8 max-h-[90vh] overflow-y-auto pb-6"
        style={{ maxWidth: 'min(680px, 95vw)' }}
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
            Configure your SEO &amp; GEO workspace.
          </p>
        </DialogHeader>

        {/* Gradient progress bar */}
        <div className="space-y-1 mb-6">
          <div className="flex justify-end">
            <span className="text-xs text-muted-foreground">
              Step {stepNumber} of {TOTAL_STEPS}
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
                Back
              </Button>
            )}
            {!canGoBack && (
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={isLoading}
                className="h-10 px-4 rounded-xl text-muted-foreground"
              >
                Close
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(!isRequired || currentStep === 'wordpress_credentials') && currentStep !== 'confirmation' && (
              <Button
                variant="ghost"
                onClick={() => void handleNext(currentQuestion?.skipLabel ? 'not sure yet' : '')}
                disabled={isLoading}
                className="h-10 px-4 rounded-xl text-muted-foreground text-sm"
              >
                {currentQuestion?.skipLabel ?? 'Skip'}
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
                  Start over
                </Button>
                <GradientButton
                  onClick={() => void handleNext()}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 border-2 border-white/60 border-r-transparent rounded-full animate-spin" />
                      Saving…
                    </span>
                  ) : 'Confirm'}
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
                    Loading…
                  </span>
                ) : 'Next'}
              </GradientButton>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
