"use client";

import { useState, useEffect, useCallback } from "react";
import type { OnboardingData } from "@/lib/onboarding-store";

interface StepToolsProps {
  data: OnboardingData;
  cmsType: OnboardingData['cmsType'];
  onToggle: (partial: Partial<OnboardingData['connectedTools']>) => void;
  onChange?: (partial: Partial<OnboardingData>) => void;
}

interface ToolDef {
  key: keyof OnboardingData['connectedTools'];
  apiPlatform: string;
  label: string;
  logo: string;
  apiKeyMode?: 'ahrefs' | 'semrush';
}

export function StepTools({ data, cmsType, onToggle, onChange }: StepToolsProps) {
  const [mounted, setMounted] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [expandedApiKey, setExpandedApiKey] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());

  useEffect(() => { setMounted(true); }, []);

  const recommended: ToolDef[] = [
    { key: 'gsc', apiPlatform: 'gsc', label: 'Search Console', logo: '/logos/google-search-console.png' },
    { key: 'ga', apiPlatform: 'ga', label: 'Analytics', logo: '/logos/google-analytics.svg' },
    { key: 'googleDrive', apiPlatform: 'googledrive', label: 'Google Drive', logo: '/logos/google-drive.png' },
    { key: 'googleDocs', apiPlatform: 'googledocs', label: 'Google Docs', logo: '/logos/google-docs.png' },
    { key: 'slack', apiPlatform: 'slack', label: 'Slack', logo: '/logos/slack.png' },
  ];

  const optional: ToolDef[] = [
    { key: 'ahrefs', apiPlatform: 'ahrefs', label: 'Ahrefs', logo: '/logos/ahrefs.ico', apiKeyMode: 'ahrefs' },
    { key: 'semrush', apiPlatform: 'semrush', label: 'SEMrush', logo: '/logos/semrush.ico', apiKeyMode: 'semrush' },
  ];

  // Fetch real connection status after mount
  useEffect(() => {
    if (!mounted || statusLoaded) return;
    Promise.allSettled(
      recommended.map((t) =>
        fetch(`/api/auth/social/${t.apiPlatform}/status`)
          .then((r) => r.ok ? r.json() as Promise<{ connected: boolean }> : { connected: false })
          .then((d) => ({ key: t.key, connected: d.connected === true }))
          .catch(() => ({ key: t.key, connected: false }))
      ),
    ).then((results) => {
      const truth: Partial<OnboardingData['connectedTools']> = {};
      for (const r of results) {
        if (r.status === 'fulfilled') truth[r.value.key] = r.value.connected;
      }
      truth.ahrefs = Boolean(data.ahrefsApiKey);
      truth.semrush = Boolean(data.semrushApiKey);
      onToggle(truth);
      setStatusLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, statusLoaded]);

  // Global postMessage listener for OAuth callbacks
  useEffect(() => {
    function onMessage(e: MessageEvent<unknown>) {
      if (typeof e.data !== "object" || !e.data || !("type" in e.data)) return;
      const msg = e.data as { type: string; platform?: string };
      if (msg.type !== "SOCIAL_CONNECTED" || !msg.platform) return;
      const match = recommended.find((t) => t.apiPlatform === msg.platform);
      if (match) {
        onToggle({ [match.key]: true });
        setConnectingPlatform(null);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onToggle]);

  const handleOAuthConnect = useCallback(async (tool: ToolDef) => {
    setConnectingPlatform(tool.apiPlatform);
    try {
      const res = await fetch(`/api/auth/social/${tool.apiPlatform}/connect`, { method: "POST" });
      if (!res.ok) { setConnectingPlatform(null); return; }
      const result = await res.json() as { redirectUrl?: string | null };
      if (!result.redirectUrl) {
        setConnectingPlatform(null);
        setUnavailable((prev) => new Set(prev).add(tool.apiPlatform));
        return;
      }
      const popup = window.open(result.redirectUrl, `connect-${tool.apiPlatform}`, "width=600,height=700,popup=1");
      if (!popup) {
        setConnectingPlatform(null);
        // eslint-disable-next-line no-alert
        alert('Please allow popups for this site to connect your tools.');
        return;
      }
      setTimeout(() => { setConnectingPlatform((c) => c === tool.apiPlatform ? null : c); }, 120_000);
    } catch {
      setConnectingPlatform(null);
    }
  }, []);

  const handleRowClick = useCallback((tool: ToolDef) => {
    if (tool.apiKeyMode) {
      setExpandedApiKey((prev) => prev === tool.apiPlatform ? null : tool.apiPlatform);
    } else {
      void handleOAuthConnect(tool);
    }
  }, [handleOAuthConnect]);

  const handleApiKeySave = useCallback((mode: 'ahrefs' | 'semrush', key: string) => {
    if (!key.trim()) return;
    if (mode === 'ahrefs') {
      onChange?.({ ahrefsApiKey: key.trim() });
      onToggle({ ahrefs: true });
    } else {
      onChange?.({ semrushApiKey: key.trim() });
      onToggle({ semrush: true });
    }
    setExpandedApiKey(null);
  }, [onChange, onToggle]);

  return (
    <div className="space-y-5">
      <Section label="Recommended">
        {recommended.map((t) => {
          const connected = mounted && data.connectedTools[t.key];
          return <ToolCard key={t.key} tool={t} connected={connected} connecting={connectingPlatform === t.apiPlatform} unavailable={unavailable.has(t.apiPlatform)} onConnect={() => handleRowClick(t)} />;
        })}
      </Section>
      <Section label="Optional">
        {optional.map((t) => {
          const connected = mounted && data.connectedTools[t.key];
          return (
            <div key={t.key}>
              <ToolCard tool={t} connected={connected} connecting={false} unavailable={false} onConnect={() => handleRowClick(t)} />
              {expandedApiKey === t.apiPlatform && !connected && (
                <ApiKeyInput
                  label={`${t.label} API key`}
                  defaultValue={t.apiKeyMode === 'ahrefs' ? data.ahrefsApiKey : data.semrushApiKey}
                  onSave={(key) => handleApiKeySave(t.apiKeyMode!, key)}
                  onCancel={() => setExpandedApiKey(null)}
                />
              )}
            </div>
          );
        })}
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function ToolCard({ tool, connected, connecting, unavailable, onConnect }: {
  tool: ToolDef;
  connected: boolean;
  connecting: boolean;
  unavailable: boolean;
  onConnect: () => void;
}) {
  const clickable = !connected && !connecting && !unavailable;

  let badgeLabel = tool.apiKeyMode ? 'API key' : 'Connect';
  let badgeBg = 'var(--muted)';
  let badgeColor = 'var(--muted-foreground)';
  if (connected) { badgeLabel = 'Connected'; badgeBg = 'rgba(23,195,178,0.1)'; badgeColor = '#17C3B2'; }
  else if (connecting) { badgeLabel = '…'; }
  else if (unavailable) { badgeLabel = 'Coming soon'; }

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={() => { if (clickable) onConnect(); }}
      onKeyDown={(e) => { if (clickable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onConnect(); } }}
      className="flex items-center gap-2.5 rounded-lg border p-2 transition-all hover:bg-muted/30"
      style={{
        borderColor: connected ? '#17C3B2' : undefined,
        backgroundColor: connected ? 'rgba(23,195,178,0.06)' : undefined,
        cursor: clickable ? 'pointer' : 'default',
        opacity: unavailable ? 0.5 : 1,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={tool.logo} alt="" className="h-6 w-6 shrink-0 rounded object-contain" />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{tool.label}</span>
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{ backgroundColor: badgeBg, color: badgeColor }}
      >
        {badgeLabel}
      </span>
    </div>
  );
}

function ApiKeyInput({ label, defaultValue, onSave, onCancel }: {
  label: string;
  defaultValue?: string;
  onSave: (key: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue ?? '');
  return (
    <div className="mt-1 flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-2 sm:col-span-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Paste your ${label}`}
        className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
        autoFocus
      />
      <button
        type="button"
        onClick={() => onSave(value)}
        disabled={!value.trim()}
        className="shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold text-white disabled:opacity-40"
        style={{ background: 'var(--elevay-gradient-btn)' }}
      >
        Save
      </button>
      <button type="button" onClick={onCancel} className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground">
        Cancel
      </button>
    </div>
  );
}
