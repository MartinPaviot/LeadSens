"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Spinner, ArrowSquareOut } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useOnboarding, type StepAction } from "../onboarding-context";

type AuthType = "api_key" | "oauth" | "coming_soon";

interface ToolDef {
  type: string;
  name: string;
  placeholder?: string;
  /** Path to SVG logo in /public — used for implemented tools */
  icon?: string;
  /** Brand color hex — used for coming-soon tools (generates initial avatar) */
  brandColor?: string;
  authType: AuthType;
}

interface Section {
  key: string;
  label: string;
  badge?: string;
  tools: ToolDef[];
}

// ─── Tool ecosystem by category ──────────────────────────
// Covers ~85% of tools used by B2B sales/SDR teams (11 categories, ~57 tools).
// Implemented tools have `icon` (SVG). Coming-soon tools have `brandColor`.
// Core categories (ESP→Warmup) separated from workflow categories (CRM→Export) by divider.

const CORE_SECTIONS: Section[] = [
  {
    key: "esp",
    label: "Email Sending",
    badge: "Required",
    tools: [
      { type: "INSTANTLY", name: "Instantly", placeholder: "Instantly API V2 Key", icon: "/instantly.svg", authType: "api_key" },
      { type: "SMARTLEAD", name: "Smartlead", placeholder: "Smartlead API Key", icon: "/smartlead.svg", authType: "api_key" },
      { type: "LEMLIST", name: "Lemlist", placeholder: "Lemlist API Key", icon: "/lemlist.svg", authType: "api_key" },
      { type: "SALESHANDY", name: "Saleshandy", brandColor: "#2196F3", authType: "coming_soon" },
      { type: "KLENTY", name: "Klenty", brandColor: "#5046E5", authType: "coming_soon" },
      { type: "QUICKMAIL", name: "QuickMail", brandColor: "#00BFA5", authType: "coming_soon" },
      { type: "WOODPECKER", name: "Woodpecker", brandColor: "#43A047", authType: "coming_soon" },
      { type: "REPLY_IO", name: "Reply.io", brandColor: "#1565C0", authType: "coming_soon" },
      { type: "MAILSHAKE", name: "Mailshake", brandColor: "#FF6D00", authType: "coming_soon" },
      { type: "YESWARE", name: "Yesware", brandColor: "#0066FF", authType: "coming_soon" },
    ],
  },
  {
    key: "leads",
    label: "Lead Database",
    tools: [
      { type: "APOLLO", name: "Apollo", placeholder: "Apollo API Key", icon: "/apollo.svg", authType: "api_key" },
      { type: "LINKEDIN_SALES_NAV", name: "Sales Navigator", brandColor: "#0A66C2", authType: "coming_soon" },
      { type: "SEAMLESS_AI", name: "Seamless.AI", brandColor: "#00C853", authType: "coming_soon" },
      { type: "ZOOMINFO", name: "ZoomInfo", brandColor: "#6B46C1", authType: "coming_soon" },
      { type: "LUSHA", name: "Lusha", brandColor: "#3B5BF5", authType: "coming_soon" },
      { type: "COGNISM", name: "Cognism", brandColor: "#6E3FF3", authType: "coming_soon" },
      { type: "ROCKETREACH", name: "RocketReach", brandColor: "#FF6600", authType: "coming_soon" },
      { type: "SNOV_IO", name: "Snov.io", brandColor: "#4FC3F7", authType: "coming_soon" },
      { type: "HUNTER_IO", name: "Hunter", brandColor: "#FF7043", authType: "coming_soon" },
      { type: "KASPR", name: "Kaspr", brandColor: "#3F51B5", authType: "coming_soon" },
      { type: "LEADIQ", name: "LeadIQ", brandColor: "#FF6B2B", authType: "coming_soon" },
    ],
  },
  {
    key: "enrichment",
    label: "Data Enrichment",
    tools: [
      { type: "CLAY", name: "Clay", brandColor: "#000000", authType: "coming_soon" },
      { type: "CLEARBIT", name: "Clearbit", brandColor: "#4B50E6", authType: "coming_soon" },
      { type: "LEADIQ_ENRICH", name: "LeadIQ", brandColor: "#00C2FF", authType: "coming_soon" },
      { type: "FULLCONTACT", name: "FullContact", brandColor: "#FF6B35", authType: "coming_soon" },
    ],
  },
  {
    key: "verification",
    label: "Email Verification",
    tools: [
      { type: "ZEROBOUNCE", name: "ZeroBounce", placeholder: "ZeroBounce API Key", icon: "/zerobounce.svg", authType: "api_key" },
      { type: "NEVERBOUNCE", name: "NeverBounce", brandColor: "#00C853", authType: "coming_soon" },
      { type: "MILLIONVERIFIER", name: "MillionVerifier", brandColor: "#2196F3", authType: "coming_soon" },
      { type: "CLEAROUT", name: "Clearout", brandColor: "#2196F3", authType: "coming_soon" },
      { type: "DEBOUNCE", name: "DeBounce", brandColor: "#4CAF50", authType: "coming_soon" },
      { type: "SCRUBBY", name: "Scrubby", brandColor: "#FF7043", authType: "coming_soon" },
      { type: "DROPCONTACT", name: "Dropcontact", brandColor: "#1E88E5", authType: "coming_soon" },
      { type: "BOUNCER", name: "Bouncer", brandColor: "#F4511E", authType: "coming_soon" },
    ],
  },
  {
    key: "warmup",
    label: "Email Warmup & Deliverability",
    tools: [
      { type: "WARMBOX", name: "Warmbox", brandColor: "#FF5722", authType: "coming_soon" },
      { type: "MAILREACH", name: "MailReach", brandColor: "#6C63FF", authType: "coming_soon" },
      { type: "WARMY", name: "Warmy", brandColor: "#FF9800", authType: "coming_soon" },
      { type: "LEMWARM", name: "Lemwarm", brandColor: "#6C5CE7", authType: "coming_soon" },
    ],
  },
];

const WORKFLOW_SECTIONS: Section[] = [
  {
    key: "crm",
    label: "CRM",
    tools: [
      { type: "HUBSPOT", name: "HubSpot", icon: "/hubspot.svg", authType: "oauth" },
      { type: "SALESFORCE", name: "Salesforce", icon: "/salesforce.svg", authType: "coming_soon" },
      { type: "PIPEDRIVE", name: "Pipedrive", brandColor: "#017737", authType: "coming_soon" },
      { type: "ZOHO", name: "Zoho CRM", brandColor: "#C8202F", authType: "coming_soon" },
      { type: "CLOSE", name: "Close", brandColor: "#5856D6", authType: "coming_soon" },
      { type: "FRESHSALES", name: "Freshsales", brandColor: "#F26522", authType: "coming_soon" },
      { type: "ATTIO", name: "Attio", brandColor: "#000000", authType: "coming_soon" },
      { type: "FOLK", name: "Folk", brandColor: "#8B5CF6", authType: "coming_soon" },
    ],
  },
  {
    key: "linkedin",
    label: "LinkedIn Outreach",
    tools: [
      { type: "WAALAXY", name: "Waalaxy", brandColor: "#4353FF", authType: "coming_soon" },
      { type: "HEYREACH", name: "HeyReach", brandColor: "#FF6B2B", authType: "coming_soon" },
      { type: "LAGROWTH", name: "LaGrowthMachine", brandColor: "#6366F1", authType: "coming_soon" },
      { type: "EXPANDI", name: "Expandi", brandColor: "#1DB954", authType: "coming_soon" },
      { type: "PHANTOMBUSTER", name: "PhantomBuster", brandColor: "#8338EC", authType: "coming_soon" },
      { type: "DUX_SOUP", name: "Dux-Soup", brandColor: "#F59E0B", authType: "coming_soon" },
    ],
  },
  {
    key: "scheduling",
    label: "Meeting Scheduling",
    tools: [
      { type: "CALENDLY", name: "Calendly", brandColor: "#006BFF", authType: "coming_soon" },
      { type: "CAL_COM", name: "Cal.com", brandColor: "#292929", authType: "coming_soon" },
      { type: "CHILI_PIPER", name: "Chili Piper", brandColor: "#FF4436", authType: "coming_soon" },
      { type: "SAVVYCAL", name: "SavvyCal", brandColor: "#7C3AED", authType: "coming_soon" },
    ],
  },
  {
    key: "automation",
    label: "Workflow Automation",
    tools: [
      { type: "ZAPIER", name: "Zapier", brandColor: "#FF4A00", authType: "coming_soon" },
      { type: "MAKE", name: "Make", brandColor: "#6D00CC", authType: "coming_soon" },
      { type: "N8N", name: "n8n", brandColor: "#EA4B71", authType: "coming_soon" },
    ],
  },
  {
    key: "notifications",
    label: "Notifications",
    tools: [
      { type: "SLACK", name: "Slack", brandColor: "#4A154B", authType: "coming_soon" },
      { type: "TEAMS", name: "Teams", brandColor: "#5558AF", authType: "coming_soon" },
    ],
  },
  {
    key: "export",
    label: "Export & Reporting",
    tools: [
      { type: "GOOGLE_SHEETS", name: "Sheets", brandColor: "#34A853", authType: "coming_soon" },
      { type: "AIRTABLE", name: "Airtable", brandColor: "#FFBE0B", authType: "coming_soon" },
      { type: "NOTION", name: "Notion", brandColor: "#000000", authType: "coming_soon" },
    ],
  },
];

const SECTIONS: Section[] = [...CORE_SECTIONS, ...WORKFLOW_SECTIONS];
const CORE_SECTION_COUNT = CORE_SECTIONS.length;

const ESP_TYPES = ["INSTANTLY", "SMARTLEAD", "LEMLIST"];
const CRM_TYPES = ["HUBSPOT", "SALESFORCE"];

// ─── Tool icon (SVG or branded initial) ──────────────────

function ToolIcon({ tool }: { tool: ToolDef }) {
  if (tool.icon) {
    return (
      <Image src={tool.icon} alt={tool.name} width={18} height={18} className="shrink-0" />
    );
  }
  return (
    <div
      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded text-[9px] font-bold text-white"
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
                const crmMatch = d.integrations.find(
                  (i: { type: string; status: string }) => CRM_TYPES.includes(i.type) && i.status === "ACTIVE",
                );
                if (crmMatch) {
                  setState((prev) => ({ ...prev, connectedCrm: crmMatch.type }));
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
              {idx === CORE_SECTION_COUNT && (
                <div className="border-t border-border/40 my-1" />
              )}
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
                  const isActive = expanded === tool.type && !connected;

                  return (
                    <button
                      key={tool.type}
                      type="button"
                      className={`flex items-center gap-1.5 h-7 px-2 rounded-md border text-[11px] font-medium transition-all ${
                        connected
                          ? "border-green-600/40 bg-green-600/5 text-green-400"
                          : isComingSoon
                            ? "border-border/50 text-muted-foreground/50 cursor-default"
                            : isActive
                              ? "border-primary/40 bg-primary/5"
                              : "border-border hover:border-teal-500/40 cursor-pointer"
                      }`}
                      onClick={() => handleToolClick(tool)}
                      disabled={isComingSoon}
                    >
                      <ToolIcon tool={tool} />
                      <span>{tool.name}</span>
                      {connected && <CheckCircle className="size-3.5 text-green-500" weight="fill" />}
                      {isComingSoon && (
                        <span className="text-[9px] text-muted-foreground/50">Soon</span>
                      )}
                      {!connected && !isComingSoon && tool.authType === "oauth" && (
                        <ArrowSquareOut className="size-3 text-muted-foreground" />
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
