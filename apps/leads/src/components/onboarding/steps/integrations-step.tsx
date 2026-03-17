"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Spinner } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useOnboarding, type StepAction } from "../onboarding-context";

type AuthType = "api_key" | "oauth" | "none" | "coming_soon";

interface ToolDef {
  type: string;
  name: string;
  placeholder?: string;
  /** Path to logo (SVG or PNG) in /public or /public/logos */
  icon?: string;
  /** Brand color hex — fallback when icon is not available */
  brandColor?: string;
  authType: AuthType;
}

interface Section {
  key: string;
  label: string;
  badge?: string;
  tools: ToolDef[];
}

// ─── Tool ecosystem by category (Pareto 80/20) ──────────
// Only the ~20% of tools per category that cover ~80% of the Western SMB/mid-market.
// Selection based on verified data: G2 reviews, Chrome Web Store installs, BuiltWith detections.
// Full connector list remains in the backend registry for Settings > Integrations.

// Ordered by pipeline stage: Source → Verify → Send → Sync → Book → Alert → Export
// Badges reflect necessity: Required = product won't work without it,
// Recommended = product works much better with it, no badge = optional.

const CORE_SECTIONS: Section[] = [
  {
    key: "leads",
    label: "Lead Database",
    badge: "Recommended",
    tools: [
      { type: "APOLLO", name: "Apollo", placeholder: "Apollo API Key", icon: "/apollo.svg", authType: "api_key" },
      { type: "ZOOMINFO", name: "ZoomInfo", icon: "/logos/zoominfo.png", authType: "oauth" },
      { type: "SEAMLESS_AI", name: "Seamless.AI", placeholder: "Seamless.AI API Key", icon: "/logos/seamless-ai.png", authType: "api_key" },
      { type: "LUSHA", name: "Lusha", placeholder: "Lusha API Key", icon: "/logos/lusha.png", authType: "api_key" },
    ],
  },
  {
    key: "verification",
    label: "Email Verification",
    badge: "Recommended",
    tools: [
      { type: "ZEROBOUNCE", name: "ZeroBounce", placeholder: "ZeroBounce API Key", icon: "/logos/zerobounce.png", authType: "api_key" },
      { type: "MILLIONVERIFIER", name: "MillionVerifier", placeholder: "MillionVerifier API Key", icon: "/logos/millionverifier.png", authType: "api_key" },
    ],
  },
  {
    key: "esp",
    label: "Email Sending",
    badge: "Required",
    tools: [
      { type: "INSTANTLY", name: "Instantly", placeholder: "Instantly API V2 Key", icon: "/instantly.svg", authType: "api_key" },
      { type: "LEMLIST", name: "Lemlist", placeholder: "Lemlist API Key", icon: "/logos/lemlist.png", authType: "api_key" },
      { type: "SMARTLEAD", name: "Smartlead", placeholder: "Smartlead API Key", icon: "/smartlead.svg", authType: "api_key" },
      { type: "REPLY_IO", name: "Reply.io", placeholder: "Reply.io API Key", icon: "/logos/reply-io.png", authType: "api_key" },
      { type: "OUTREACH", name: "Outreach", icon: "/logos/outreach.png", authType: "oauth" },
    ],
  },
];

const WORKFLOW_SECTIONS: Section[] = [
  {
    key: "crm",
    label: "CRM",
    tools: [
      { type: "HUBSPOT", name: "HubSpot", icon: "/hubspot.svg", authType: "oauth" },
      { type: "SALESFORCE", name: "Salesforce", icon: "/salesforce.svg", authType: "oauth" },
      { type: "PIPEDRIVE", name: "Pipedrive", placeholder: "Pipedrive API Token", icon: "/logos/pipedrive.png", authType: "api_key" },
    ],
  },
  {
    key: "workflow",
    label: "Workflow & Export",
    tools: [
      { type: "CALENDLY", name: "Calendly", icon: "/logos/calendly.png", authType: "oauth" },
      { type: "SLACK", name: "Slack", icon: "/logos/slack.png", authType: "oauth" },
      { type: "CSV", name: "CSV", brandColor: "#10B981", authType: "none" },
      { type: "AIRTABLE", name: "Airtable", placeholder: "Airtable Personal Access Token", icon: "/logos/airtable.png", authType: "api_key" },
      { type: "NOTION", name: "Notion", placeholder: "Notion Integration Token", icon: "/logos/notion.png", authType: "api_key" },
    ],
  },
];

const SECTIONS: Section[] = [...CORE_SECTIONS, ...WORKFLOW_SECTIONS];

const ESP_TYPES = [
  "INSTANTLY", "SMARTLEAD", "LEMLIST", "SALESHANDY", "KLENTY",
  "QUICKMAIL", "WOODPECKER", "REPLY_IO", "MAILSHAKE",
  "SALESLOFT", "GMASS", "SNOV_IO", "OUTREACH",
];
const CRM_TYPES = ["HUBSPOT", "SALESFORCE", "PIPEDRIVE"];

// ─── Tool icon (real logo or branded initial fallback) ───

function ToolIcon({ tool, dimmed }: { tool: ToolDef; dimmed?: boolean }) {
  if (tool.icon) {
    return (
      <Image
        src={tool.icon}
        alt={tool.name}
        width={18}
        height={18}
        className={`shrink-0 rounded-sm ${dimmed ? "opacity-50 grayscale" : ""}`}
      />
    );
  }
  return (
    <div
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded text-[9px] font-bold text-white ${dimmed ? "opacity-50" : ""}`}
      style={{ backgroundColor: tool.brandColor ?? "#6B7280" }}
    >
      {tool.name.charAt(0)}
    </div>
  );
}

// ─── Integrations step ───────────────────────────────────

export function IntegrationsStep() {
  const { state, setState, nextStep, setStepAction } = useOnboarding();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const oauthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (oauthPollRef.current) clearInterval(oauthPollRef.current);
    };
  }, []);

  const isToolConnected = useCallback(
    (type: string) => {
      if (ESP_TYPES.includes(type)) return state.connectedEsp === type;
      if (CRM_TYPES.includes(type)) return state.connectedCrm === type;
      return state.connectedTools.includes(type);
    },
    [state.connectedEsp, state.connectedCrm, state.connectedTools],
  );

  const connectApiKey = useCallback(
    async (tool: ToolDef) => {
      if (!apiKey.trim()) return;
      setConnecting(true);
      try {
        const res = await fetch(`/api/integrations/${tool.type.toLowerCase()}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey }),
        });
        const data = await res.json();
        if (res.ok) {
          const accounts = data.accounts ? ` (${data.accounts} accounts)` : "";
          toast.success(`${tool.name} connected${accounts}`);
          setState((prev) => {
            if (ESP_TYPES.includes(tool.type)) return { ...prev, connectedEsp: tool.type };
            if (CRM_TYPES.includes(tool.type)) return { ...prev, connectedCrm: tool.type };
            if (!prev.connectedTools.includes(tool.type)) return { ...prev, connectedTools: [...prev.connectedTools, tool.type] };
            return prev;
          });
          setApiKey("");
          setExpanded(null);
        } else {
          toast.error(data.error || "Connection failed");
        }
      } catch {
        toast.error("Connection failed");
      } finally {
        setConnecting(false);
      }
    },
    [apiKey, setState],
  );

  const connectOAuth = useCallback(
    (tool: ToolDef) => {
      const popup = window.open(
        `/api/integrations/${tool.type.toLowerCase()}/auth`,
        `${tool.type.toLowerCase()}-oauth`,
        "width=600,height=700",
      );
      if (popup) {
        oauthPollRef.current = setInterval(async () => {
          if (popup.closed) {
            if (oauthPollRef.current) clearInterval(oauthPollRef.current);
            oauthPollRef.current = null;
            try {
              const res = await fetch("/api/trpc/workspace.getOnboardingData");
              const data = await res.json();
              const d = data?.result?.data;
              if (d?.integrations) {
                const match = d.integrations.find(
                  (i: { type: string; status: string }) => i.type === tool.type && i.status === "ACTIVE",
                );
                if (match) {
                  setState((prev) => {
                    if (ESP_TYPES.includes(tool.type)) return { ...prev, connectedEsp: tool.type };
                    if (CRM_TYPES.includes(tool.type)) return { ...prev, connectedCrm: tool.type };
                    if (!prev.connectedTools.includes(tool.type)) return { ...prev, connectedTools: [...prev.connectedTools, tool.type] };
                    return prev;
                  });
                  toast.success(`${tool.name} connected`);
                }
              }
            } catch { /* Best-effort */ }
          }
        }, 500);
      }
    },
    [setState],
  );

  const handleToolClick = useCallback(
    (tool: ToolDef) => {
      if (isToolConnected(tool.type)) return;
      if (tool.authType === "api_key") {
        if (expanded !== tool.type) { setExpanded(tool.type); setApiKey(""); }
      } else if (tool.authType === "oauth") {
        connectOAuth(tool);
      }
    },
    [expanded, isToolConnected, connectOAuth],
  );

  useEffect(() => {
    const action: StepAction = {
      label: state.connectedEsp ? "Continue" : "Continue without ESP",
      onClick: nextStep,
    };
    if (!state.connectedEsp) {
      action.secondary = (
        <p className="text-[10px] text-muted-foreground">
          You&apos;ll need an ESP to send campaigns
        </p>
      );
    }
    setStepAction(action);
  }, [state.connectedEsp, nextStep, setStepAction]);

  return (
    <div>
      <div className="text-center">
        <h2 className="text-lg font-semibold">Connect your tools</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          LeadSens orchestrates your existing stack
        </p>
      </div>

      <div className="space-y-2 pt-2">
        {SECTIONS.map((section, idx) => {
          const expandedTool = section.tools.find(
            (t) => expanded === t.type && !isToolConnected(t.type) && t.authType === "api_key",
          );

          return (
            <div key={section.key}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  {section.label}
                </span>
                {section.badge && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-3.5 leading-none">
                    {section.badge}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-1">
                {section.tools.map((tool) => {
                  const connected = isToolConnected(tool.type);
                  const isComingSoon = tool.authType === "coming_soon";
                  const isBuiltIn = tool.authType === "none";
                  const isActive = expanded === tool.type && !connected;

                  return (
                    <button
                      key={tool.type}
                      type="button"
                      className={`flex items-center gap-1.5 h-7 px-2 rounded-md border text-[11px] font-medium transition-all ${
                        connected
                          ? "border-green-600/40 bg-green-600/5 text-green-400"
                          : isBuiltIn
                            ? "border-blue-600/40 bg-blue-600/5 text-blue-400 cursor-default"
                            : isComingSoon
                              ? "border-border/50 text-muted-foreground/50 cursor-default"
                              : isActive
                                ? "border-primary/40 bg-primary/5"
                                : "border-border hover:border-teal-500/40 cursor-pointer"
                      }`}
                      onClick={() => handleToolClick(tool)}
                      disabled={isComingSoon || isBuiltIn}
                    >
                      <ToolIcon tool={tool} dimmed={isComingSoon} />
                      <span>{tool.name}</span>
                      {connected && <CheckCircle className="size-3.5 text-green-500" weight="fill" />}
                      {isBuiltIn && (
                        <span className="text-[9px] text-blue-400/70">Built-in</span>
                      )}
                      {isComingSoon && (
                        <span className="text-[9px] text-muted-foreground/50">Soon</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {expandedTool && (
                <div className="flex gap-2 mt-1.5" onClick={(e) => e.stopPropagation()}>
                  <Input
                    type="password"
                    placeholder={expandedTool.placeholder}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") connectApiKey(expandedTool); }}
                    className="h-7 text-xs"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    className="h-7 text-xs px-3 shrink-0"
                    onClick={() => connectApiKey(expandedTool)}
                    disabled={connecting || !apiKey.trim()}
                  >
                    {connecting ? <Spinner className="size-3 animate-spin" /> : "Connect"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
