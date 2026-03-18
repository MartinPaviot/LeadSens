"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { Input, Button, Badge } from "@leadsens/ui";
import { CheckCircle, Eye, EyeSlash, Lock, Spinner, XCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useOnboarding, type StepAction } from "../onboarding-context";

type AuthType = "api_key" | "oauth" | "composio" | "none" | "coming_soon";

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
      { type: "ZOOMINFO", name: "ZoomInfo", placeholder: "client_id:client_secret", icon: "/logos/zoominfo.png", authType: "api_key" },
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
      { type: "LEMLIST", name: "Lemlist", icon: "/logos/lemlist.png", authType: "composio" },
      { type: "SMARTLEAD", name: "Smartlead", placeholder: "Smartlead API Key", icon: "/smartlead.svg", authType: "api_key" },
      { type: "REPLY_IO", name: "Reply.io", placeholder: "Reply.io API Key", icon: "/logos/reply-io.png", authType: "api_key" },
    ],
  },
];

const WORKFLOW_SECTIONS: Section[] = [
  {
    key: "crm",
    label: "CRM",
    tools: [
      { type: "HUBSPOT", name: "HubSpot", icon: "/hubspot.svg", authType: "composio" },
      { type: "SALESFORCE", name: "Salesforce", icon: "/salesforce.svg", authType: "composio" },
      { type: "PIPEDRIVE", name: "Pipedrive", icon: "/logos/pipedrive.png", authType: "composio" },
    ],
  },
  {
    key: "workflow",
    label: "Workflow & Export",
    tools: [
      { type: "CALENDLY", name: "Calendly", icon: "/logos/calendly.png", authType: "composio" },
      { type: "SLACK", name: "Slack", icon: "/logos/slack.png", authType: "composio" },
      { type: "CSV", name: "CSV", brandColor: "#10B981", authType: "none" },
      { type: "AIRTABLE", name: "Airtable", icon: "/logos/airtable.png", authType: "composio" },
      { type: "NOTION", name: "Notion", icon: "/logos/notion.png", authType: "composio" },
      { type: "GOOGLE_SHEETS", name: "Google Sheets", icon: "/logos/google-sheets.png", authType: "composio" },
    ],
  },
];

const SECTIONS: Section[] = [...CORE_SECTIONS, ...WORKFLOW_SECTIONS];

const API_KEY_HELP_URLS: Record<string, string> = {
  APOLLO:           "https://app.apollo.io/#/settings/integrations/api",
  INSTANTLY:        "https://app.instantly.ai/app/settings/integrations",
  SMARTLEAD:        "https://app.smartlead.ai/app/settings",
  REPLY_IO:         "https://app.reply.io/settings",
  ZEROBOUNCE:       "https://app.zerobounce.net/members/apikey",
  MILLIONVERIFIER:  "https://app.millionverifier.com/settings",
  SEAMLESS_AI:      "https://login.seamless.ai/settings/api",
  LUSHA:            "https://www.lusha.com/settings/api",
  ZOOMINFO:         "https://app.zoominfo.com/apps/integrations",
};

type ValidationState = "idle" | "loading" | "valid" | "invalid";

function TrustNote({
  toolId,
  state = "idle",
  error,
}: {
  toolId: string;
  state?: ValidationState;
  error?: string;
}) {
  const helpUrl = API_KEY_HELP_URLS[toolId];
  return (
    <div className="flex items-center justify-between mt-1 px-0.5">
      <span className="flex items-center gap-1 text-[9px]">
        {state === "idle"    && <Lock      className="size-2.5 shrink-0 text-muted-foreground/60" />}
        {state === "loading" && <Spinner   className="size-2.5 animate-spin text-muted-foreground/60" />}
        {state === "valid"   && <CheckCircle className="size-2.5 text-green-500" weight="fill" />}
        {state === "invalid" && <XCircle   className="size-2.5 text-red-500" weight="fill" />}
        <span className={
          state === "valid"   ? "text-green-500" :
          state === "invalid" ? "text-red-400" :
          "text-muted-foreground/60"
        }>
          {state === "idle"    && "AES-256 encrypted · Never shared"}
          {state === "loading" && "Validating…"}
          {state === "valid"   && "Key valid"}
          {state === "invalid" && (error ?? "Invalid key")}
        </span>
      </span>
      {helpUrl && state === "idle" && (
        <a
          href={helpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          Where to find it →
        </a>
      )}
    </div>
  );
}

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
  const [showKey, setShowKey] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectingTool, setConnectingTool] = useState<string | null>(null);
  const [validationState, setValidationState] = useState<ValidationState>("idle");
  const [validationError, setValidationError] = useState<string | undefined>();
  const oauthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const validationAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (oauthPollRef.current) clearInterval(oauthPollRef.current);
      validationAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setShowKey(false);
    setValidationState("idle");
    setValidationError(undefined);
    validationAbortRef.current?.abort();
    validationAbortRef.current = null;
  }, [expanded]);

  const validateApiKey = useCallback(async (toolId: string, key: string) => {
    if (!key.trim()) return;
    validationAbortRef.current?.abort();
    const controller = new AbortController();
    validationAbortRef.current = controller;
    setValidationState("loading");
    try {
      const res = await fetch(`/api/integrations/${toolId.toLowerCase()}`, {
        headers: { "x-api-key": key },
        signal: controller.signal,
      });
      const data = await res.json() as { valid?: boolean; error?: string };
      if (data.valid) {
        setValidationState("valid");
        setValidationError(undefined);
      } else {
        setValidationState("invalid");
        setValidationError(data.error);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setValidationState("idle");
    }
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
          body: JSON.stringify({ apiKey, ...(validationState === "valid" ? { preValidated: true } : {}) }),
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
    [apiKey, setState, validationState],
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

  const connectComposioOAuth = useCallback(
    async (tool: ToolDef) => {
      setConnectingTool(tool.type);
      try {
        const authRes = await fetch(
          `/api/integrations/${tool.type.toLowerCase()}/composio/auth`,
        );
        if (!authRes.ok) {
          const msg = authRes.status === 503
            ? "Cette intégration sera disponible prochainement"
            : "Échec de connexion. Réessayez.";
          toast.error(msg);
          return;
        }
        const { redirectUrl, connectionId } = (await authRes.json()) as {
          redirectUrl: string;
          connectionId: string;
        };

        const popup = window.open(
          redirectUrl,
          `${tool.type.toLowerCase()}-composio`,
          "width=600,height=700",
        );

        if (!popup) {
          toast.error("Popup blocked. Please allow popups for this site.");
          return;
        }

        oauthPollRef.current = setInterval(async () => {
          if (!popup.closed) return;

          if (oauthPollRef.current) {
            clearInterval(oauthPollRef.current);
            oauthPollRef.current = null;
          }

          try {
            const verifyRes = await fetch(
              `/api/integrations/${tool.type.toLowerCase()}/composio/verify?connectionId=${connectionId}`,
            );
            const data = (await verifyRes.json()) as {
              connected?: boolean;
              error?: string;
            };

            if (data.connected) {
              setState((prev) => {
                if (ESP_TYPES.includes(tool.type)) return { ...prev, connectedEsp: tool.type };
                if (CRM_TYPES.includes(tool.type)) return { ...prev, connectedCrm: tool.type };
                if (!prev.connectedTools.includes(tool.type)) return { ...prev, connectedTools: [...prev.connectedTools, tool.type] };
                return prev;
              });
              toast.success(`${tool.name} connected`);
            } else {
              toast.error(`${tool.name} connection not completed`);
            }
          } catch { /* Best-effort */ }
          finally {
            setConnectingTool(null);
          }
        }, 500);
      } catch {
        toast.error("Connection failed");
      } finally {
        // Only clear if popup never opened (poll handles the connected case)
        if (!oauthPollRef.current) setConnectingTool(null);
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
      } else if (tool.authType === "composio") {
        void connectComposioOAuth(tool);
      }
    },
    [expanded, isToolConnected, connectOAuth, connectComposioOAuth],
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

                  const isOAuthConnecting = connectingTool === tool.type;

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
                              : isOAuthConnecting
                                ? "border-primary/40 bg-primary/5 cursor-wait"
                                : isActive
                                  ? "border-primary/40 bg-primary/5"
                                  : "border-border hover:border-teal-500/40 cursor-pointer"
                      }`}
                      onClick={() => handleToolClick(tool)}
                      disabled={isComingSoon || isBuiltIn || isOAuthConnecting}
                    >
                      <ToolIcon tool={tool} dimmed={isComingSoon} />
                      <span>{tool.name}</span>
                      {isOAuthConnecting && <Spinner className="size-3 animate-spin" />}
                      {connected && !isOAuthConnecting && <CheckCircle className="size-3.5 text-green-500" weight="fill" />}
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
                <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showKey ? "text" : "password"}
                        placeholder={expandedTool.placeholder}
                        value={apiKey}
                        onChange={(e) => {
                          setApiKey(e.target.value);
                          if (validationState !== "idle") {
                            setValidationState("idle");
                            setValidationError(undefined);
                          }
                        }}
                        onBlur={() => { if (apiKey.trim()) void validateApiKey(expandedTool.type, apiKey); }}
                        onKeyDown={(e) => { if (e.key === "Enter") connectApiKey(expandedTool); }}
                        className={`h-7 text-xs pr-7 ${
                          validationState === "valid"   ? "border-green-500 focus-visible:ring-green-500/20" :
                          validationState === "invalid" ? "border-red-500 focus-visible:ring-red-500/20" : ""
                        }`}
                        autoFocus
                      />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setShowKey((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showKey ? <EyeSlash className="size-3" /> : <Eye className="size-3" />}
                      </button>
                    </div>
                    <Button
                      size="sm"
                      className="h-7 text-xs px-3 shrink-0"
                      onClick={() => connectApiKey(expandedTool)}
                      disabled={connecting || !apiKey.trim()}
                    >
                      {connecting ? <Spinner className="size-3 animate-spin" /> : "Connect"}
                    </Button>
                  </div>
                  <TrustNote toolId={expandedTool.type} state={validationState} error={validationError} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
