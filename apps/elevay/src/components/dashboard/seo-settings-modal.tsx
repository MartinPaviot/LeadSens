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
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────

interface SeoSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CmsType = 'wordpress' | 'hubspot' | 'shopify' | 'webflow' | 'none' | 'other';
type AutomationLevel = 'audit' | 'semi-auto' | 'full-auto';
type AlertChannel = 'email' | 'slack' | 'digest';

interface FormData {
  siteUrl: string;
  sector: string;
  targetAudience: string;
  toneOfVoice: string;
  primaryCta: string;
  language: string;
  cmsType: CmsType;
  otherCms: string;
  connectedTools: Record<string, boolean>;
  automationLevel: AutomationLevel;
  alertChannel: AlertChannel;
}

const DEFAULT_FORM: FormData = {
  siteUrl: '',
  sector: '',
  targetAudience: '',
  toneOfVoice: 'professional',
  primaryCta: '',
  language: 'en',
  cmsType: 'none',
  otherCms: '',
  connectedTools: { gsc: false, ga: false, cms: false, googleDrive: false, googleDocs: false, slack: false, ahrefs: false, semrush: false },
  automationLevel: 'semi-auto',
  alertChannel: 'email',
};

// ─── Constants ────────────────────────────────────────────

const CMS_OPTIONS: { value: CmsType; label: string }[] = [
  { value: 'wordpress', label: 'WordPress' },
  { value: 'hubspot', label: 'HubSpot' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'webflow', label: 'Webflow' },
  { value: 'none', label: 'No CMS' },
  { value: 'other', label: 'Other' },
];

const TOOL_ROWS: { key: string; label: string; desc: string; section: 'recommended' | 'optional' }[] = [
  { key: 'gsc', label: 'Google Search Console', desc: 'Rankings, clicks, impressions', section: 'recommended' },
  { key: 'ga', label: 'Google Analytics', desc: 'Traffic, sessions, conversions', section: 'recommended' },
  { key: 'ahrefs', label: 'Ahrefs', desc: 'Backlink analysis, domain rating', section: 'optional' },
  { key: 'semrush', label: 'SEMrush', desc: 'Keyword research, competitor analysis', section: 'optional' },
  { key: 'slack', label: 'Slack', desc: 'Real-time notifications', section: 'optional' },
];

const AUTOMATION_LEVELS: { value: AutomationLevel; title: string; desc: string }[] = [
  { value: 'audit', title: 'Audit only', desc: 'Reports only — you decide what to apply and do it yourself.' },
  { value: 'semi-auto', title: 'Semi-automatic', desc: 'Elevay applies nothing without your approval. Every correction and draft is shown to you first.' },
  { value: 'full-auto', title: 'Full automatic', desc: 'Elevay silently fixes technical issues. You only approve content before publishing.' },
];

const ALERT_CHANNELS: { value: AlertChannel; title: string; desc: string }[] = [
  { value: 'email', title: 'Email', desc: 'Notifications with one-click approve / reject links.' },
  { value: 'slack', title: 'Slack', desc: 'Messages to a channel with action buttons.' },
  { value: 'digest', title: 'Weekly digest only', desc: 'No real-time alerts. A summary every Monday.' },
];

// ─── Component ────────────────────────────────────────────

export function SeoSettingsModal({ open, onOpenChange }: SeoSettingsModalProps) {
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  // Load existing profile
  useEffect(() => {
    if (!open || loaded) return;
    (async () => {
      try {
        const res = await fetch('/api/onboarding/profile');
        if (!res.ok) return;
        const data = await res.json() as { profile: { brand_url: string; language: string; sector: string | null; social_connections: Record<string, boolean> | null } | null };
        if (!data.profile) return;
        const p = data.profile;
        setForm((prev) => ({
          ...prev,
          siteUrl: p.brand_url ?? '',
          language: p.language ?? 'en',
          sector: p.sector ?? '',
          connectedTools: {
            ...prev.connectedTools,
            ...(p.social_connections ?? {}),
          },
        }));
      } catch {
        // best-effort
      } finally {
        setLoaded(true);
      }
    })();
  }, [open, loaded]);

  // Reset loaded state when modal closes
  useEffect(() => {
    if (!open) setLoaded(false);
  }, [open]);

  const update = useCallback((partial: Partial<FormData>) => {
    setForm((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleOAuthConnect = useCallback(async (platform: string) => {
    setConnectingPlatform(platform);
    try {
      const res = await fetch(`/api/auth/social/${platform}/connect`, { method: "POST" });
      if (!res.ok) { setConnectingPlatform(null); return; }
      const data = await res.json() as { redirectUrl?: string | null };
      if (!data.redirectUrl) { setConnectingPlatform(null); return; }

      const popup = window.open(data.redirectUrl, `connect-${platform}`, "width=600,height=700,popup=1");
      if (!popup) { setConnectingPlatform(null); return; }
      const openedPopup = popup;

      function cleanup() {
        window.removeEventListener("message", onMessage);
        clearInterval(closeWatcher);
        setConnectingPlatform(null);
      }
      function onMessage(e: MessageEvent<unknown>) {
        if (typeof e.data !== "object" || !e.data || !("type" in e.data)) return;
        const msg = e.data as { type: string };
        if (msg.type !== "SOCIAL_CONNECTED") return;
        setForm((prev) => ({
          ...prev,
          connectedTools: { ...prev.connectedTools, [platform]: true },
        }));
        cleanup();
        openedPopup.close();
      }
      const closeWatcher = setInterval(() => { if (openedPopup.closed) cleanup(); }, 500);
      window.addEventListener("message", onMessage);
    } catch {
      setConnectingPlatform(null);
    }
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: form.siteUrl,
          language: form.language,
          sector: form.sector || undefined,
          toneOfVoice: form.toneOfVoice || undefined,
          cmsType: form.cmsType,
          otherCms: form.cmsType === 'other' ? form.otherCms : undefined,
          connectedTools: form.connectedTools,
          automationLevel: form.automationLevel,
          alertChannel: form.alertChannel,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Settings saved');
      onOpenChange(false);
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [form, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>SEO Settings</DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-8">
          {/* ─── Section 1: Website & Business ────────────── */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Website & Business</h3>
            <div className="space-y-3">
              <Field label="Website URL">
                <Input value={form.siteUrl} onChange={(e) => update({ siteUrl: e.target.value })} placeholder="https://yoursite.com" />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Industry / sector">
                  <Input value={form.sector} onChange={(e) => update({ sector: e.target.value })} placeholder="e.g. B2B SaaS" />
                </Field>
                <Field label="Primary language">
                  <select
                    value={form.language}
                    onChange={(e) => update({ language: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="en">English</option>
                    <option value="fr">French</option>
                    <option value="es">Spanish</option>
                    <option value="de">German</option>
                  </select>
                </Field>
              </div>
              <Field label="Target audience">
                <Input value={form.targetAudience} onChange={(e) => update({ targetAudience: e.target.value })} placeholder="e.g. Marketing managers" />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Tone of voice">
                  <select
                    value={form.toneOfVoice}
                    onChange={(e) => update({ toneOfVoice: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="professional">Professional</option>
                    <option value="casual">Casual & friendly</option>
                    <option value="technical">Expert / technical</option>
                    <option value="inspiring">Inspiring</option>
                  </select>
                </Field>
                <Field label="Primary CTA">
                  <Input value={form.primaryCta} onChange={(e) => update({ primaryCta: e.target.value })} placeholder="e.g. Book a demo" />
                </Field>
              </div>
            </div>
          </section>

          {/* ─── Section 2: CMS ───────────────────────────── */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your CMS</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CMS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update({ cmsType: opt.value })}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
                    form.cmsType === opt.value ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/50",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {form.cmsType === 'other' && (
              <Input
                value={form.otherCms}
                onChange={(e) => update({ otherCms: e.target.value })}
                placeholder="Which CMS do you use?"
              />
            )}
          </section>

          {/* ─── Section 3: Connected Tools ───────────────── */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Connected tools</h3>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Recommended</p>
                <div className="space-y-2">
                  {TOOL_ROWS.filter((t) => t.section === 'recommended').map((tool) => (
                    <ToolButton
                      key={tool.key}
                      tool={tool}
                      connected={form.connectedTools[tool.key] === true}
                      connecting={connectingPlatform === tool.key}
                      onConnect={() => void handleOAuthConnect(tool.key)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Optional</p>
                <div className="space-y-2">
                  {TOOL_ROWS.filter((t) => t.section === 'optional').map((tool) => (
                    <ToolButton
                      key={tool.key}
                      tool={tool}
                      connected={form.connectedTools[tool.key] === true}
                      connecting={connectingPlatform === tool.key}
                      onConnect={() => void handleOAuthConnect(tool.key)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ─── Section 4: Automation Level ──────────────── */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Automation level</h3>
            <div className="space-y-2">
              {AUTOMATION_LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => update({ automationLevel: level.value })}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all",
                    form.automationLevel === level.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                  )}
                >
                  <div
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
                    style={{ borderColor: form.automationLevel === level.value ? '#17C3B2' : 'var(--border)' }}
                  >
                    {form.automationLevel === level.value && (
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: '#17C3B2' }} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{level.title}</p>
                    <p className="text-xs text-muted-foreground">{level.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* ─── Section 5: Alert Channel ─────────────────── */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alert channel</h3>
            <div className="space-y-2">
              {ALERT_CHANNELS.map((ch) => (
                <button
                  key={ch.value}
                  onClick={() => update({ alertChannel: ch.value })}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all",
                    form.alertChannel === ch.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                  )}
                >
                  <div
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
                    style={{ borderColor: form.alertChannel === ch.value ? '#17C3B2' : 'var(--border)' }}
                  >
                    {form.alertChannel === ch.value && (
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: '#17C3B2' }} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{ch.title}</p>
                    <p className="text-xs text-muted-foreground">{ch.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* ─── Save button ────────────────────────────────── */}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <button
            onClick={handleSave}
            disabled={saving || !form.siteUrl}
            className="rounded-full px-5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #17C3B2, #2C6BED)' }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shared sub-components ────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function ToolButton({
  tool,
  connected,
  connecting,
  onConnect,
}: {
  tool: { key: string; label: string; desc: string };
  connected: boolean;
  connecting: boolean;
  onConnect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => { if (!connected && !connecting) onConnect(); }}
      disabled={connected || connecting}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all",
        connected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
        connecting && "opacity-70",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{tool.label}</p>
        <p className="text-xs text-muted-foreground">{tool.desc}</p>
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
}
