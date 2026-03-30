"use client";

import { useState } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import type { OnboardingData } from "@/lib/onboarding-store";

interface StepToolsProps {
  data: OnboardingData;
  cmsType: OnboardingData['cmsType'];
  onToggle: (partial: Partial<OnboardingData['connectedTools']>) => void;
}

interface ToolRow {
  key: keyof OnboardingData['connectedTools'];
  label: string;
  description: string;
  icon: string;
  color: string;
}

const CMS_LABELS: Record<string, string> = {
  wordpress: 'WordPress',
  hubspot: 'HubSpot',
  shopify: 'Shopify',
  webflow: 'Webflow',
};

export function StepTools({ data, cmsType, onToggle }: StepToolsProps) {
  const [googleExpanded, setGoogleExpanded] = useState(false);

  const cmsLabel = CMS_LABELS[cmsType] ?? null;

  const recommended: ToolRow[] = [
    { key: 'gsc', label: 'Google Search Console', description: 'Rankings, clicks, impressions', icon: 'G', color: '#4285F4' },
    { key: 'ga', label: 'Google Analytics', description: 'Traffic, sessions, conversions', icon: 'GA', color: '#E37400' },
    ...(cmsLabel
      ? [{ key: 'cms' as const, label: cmsLabel, description: 'Direct draft creation and publishing', icon: cmsLabel[0], color: '#17C3B2' }]
      : []),
  ];

  const optional: ToolRow[] = [
    { key: 'ahrefs', label: 'Ahrefs', description: 'Backlink analysis, domain rating', icon: 'Ah', color: '#FF6B35' },
    { key: 'semrush', label: 'SEMrush', description: 'Keyword research, competitor analysis', icon: 'Se', color: '#FF622D' },
  ];

  return (
    <div className="space-y-6">
      {/* RECOMMENDED */}
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Recommended</p>
        <div className="space-y-2">
          {recommended.map((tool) => (
            <ToolItem key={tool.key} tool={tool} connected={data.connectedTools[tool.key]} onToggle={() => onToggle({ [tool.key]: !data.connectedTools[tool.key] })} />
          ))}
        </div>
      </div>

      {/* REPORTS & EXPORTS */}
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Reports & exports</p>
        <div className="space-y-2">
          {/* Google Workspace expandable */}
          <button
            onClick={() => setGoogleExpanded(!googleExpanded)}
            className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-primary/30"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: '#4285F4' }}>
              GW
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Google Workspace</p>
              <p className="text-xs text-muted-foreground">Drive + Docs for report exports</p>
            </div>
            {googleExpanded ? <CaretUp size={14} className="text-muted-foreground" /> : <CaretDown size={14} className="text-muted-foreground" />}
          </button>

          {googleExpanded && (
            <div className="ml-3 space-y-2 border-l-2 pl-3" style={{ borderColor: '#17C3B2' }}>
              <ToolItem
                tool={{ key: 'googleDrive', label: 'Google Drive', description: 'Store reports and exports', icon: 'D', color: '#0F9D58' }}
                connected={data.connectedTools.googleDrive}
                onToggle={() => onToggle({ googleDrive: !data.connectedTools.googleDrive })}
              />
              <ToolItem
                tool={{ key: 'googleDocs', label: 'Google Docs', description: 'Export content as editable docs', icon: 'Dc', color: '#4285F4' }}
                connected={data.connectedTools.googleDocs}
                onToggle={() => onToggle({ googleDocs: !data.connectedTools.googleDocs })}
              />
            </div>
          )}

          <ToolItem
            tool={{ key: 'slack', label: 'Slack', description: 'Notifications and approval workflow', icon: 'Sl', color: '#4A154B' }}
            connected={data.connectedTools.slack}
            onToggle={() => onToggle({ slack: !data.connectedTools.slack })}
          />
        </div>
      </div>

      {/* OPTIONAL */}
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Optional</p>
        <div className="space-y-2">
          {optional.map((tool) => (
            <ToolItem key={tool.key} tool={tool} connected={data.connectedTools[tool.key]} onToggle={() => onToggle({ [tool.key]: !data.connectedTools[tool.key] })} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ToolItem({ tool, connected, onToggle }: { tool: ToolRow; connected: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-150"
      style={{
        borderColor: connected ? '#17C3B2' : undefined,
        backgroundColor: connected ? 'rgba(23,195,178,0.06)' : undefined,
      }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
        style={{ backgroundColor: tool.color }}
      >
        {tool.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{tool.label}</p>
        <p className="text-xs text-muted-foreground">{tool.description}</p>
      </div>
      <span
        className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
        style={{
          backgroundColor: connected ? 'rgba(23,195,178,0.1)' : 'var(--muted)',
          color: connected ? '#17C3B2' : 'var(--muted-foreground)',
        }}
      >
        {connected ? 'Connected' : 'Connect'}
      </span>
    </button>
  );
}
