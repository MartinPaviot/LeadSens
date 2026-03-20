"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Button, Card, Input, Badge } from "@leadsens/ui";
import { toast } from "sonner";
import { CheckCircle, Eye, EyeSlash, FileArrowUp, Lock, Spinner, XCircle, Star } from "@phosphor-icons/react";
import type { ConnectorMeta, ConnectorCategory } from "@/server/lib/integrations/types";

// ─── Registry data (client-safe, imported at build time) ──

import {
  getAllConnectorMetas,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from "@/server/lib/integrations/registry";

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

// ─── Constants ──────────────────────────────────────────

const ESSENTIAL_CATEGORIES: ConnectorCategory[] = ["esp", "lead_database"];
const RECOMMENDED_IDS = new Set(["INSTANTLY", "APOLLO", "HUBSPOT"]);
const CATEGORY_DESCRIPTIONS: Record<ConnectorCategory, string> = {
  esp: "Send your campaigns. Required to go from drafted emails to live outreach.",
  lead_database: "Find leads matching your ICP with verified contact data.",
  crm: "Auto-push contacts and deals to your CRM when leads reply.",
  email_verification: "Verify emails before sending to protect your sender reputation.",
  enrichment: "Add company and contact data to improve personalization.",
  warmup: "Warm up new email accounts to improve deliverability.",
  linkedin_outreach: "Automate LinkedIn connection requests and messages.",
  scheduling: "Let prospects book meetings directly from your emails.",
  workflow: "Connect LeadSens to your existing automation workflows.",
  notification: "Get notified in your team channels when leads reply.",
  export: "Export lead data to spreadsheets and databases.",
};

// Pareto 80/20: only the ~20% of tools per category that cover ~80% of the market.
const PARETO_IDS = new Set([
  "INSTANTLY", "LEMLIST", "SMARTLEAD", "REPLY_IO",
  "APOLLO", "ZOOMINFO", "SEAMLESS_AI", "LUSHA",
  "ZEROBOUNCE", "MILLIONVERIFIER",
  "HUBSPOT", "SALESFORCE", "PIPEDRIVE",
  "CALENDLY",
  "SLACK",
  "CSV", "AIRTABLE", "NOTION", "GOOGLE_SHEETS",
]);

const ALL_CONNECTORS = getAllConnectorMetas().filter(c => PARETO_IDS.has(c.id));

interface Integration {
  type: string;
  status: string;
  accountEmail?: string | null;
}

// ─── Logo mapping (real assets in /public) ──────────────

const LOGO_PATHS: Record<string, string> = {
  INSTANTLY:       "/instantly.svg",
  APOLLO:          "/apollo.svg",
  HUBSPOT:         "/hubspot.svg",
  SALESFORCE:      "/salesforce.svg",
  SMARTLEAD:       "/smartlead.svg",
  LEMLIST:         "/logos/lemlist.png",
  REPLY_IO:        "/logos/reply-io.png",
  PIPEDRIVE:       "/logos/pipedrive.png",
  ZEROBOUNCE:      "/logos/zerobounce.png",
  MILLIONVERIFIER: "/logos/millionverifier.png",
  SEAMLESS_AI:     "/logos/seamless-ai.png",
  LUSHA:           "/logos/lusha.png",
  ZOOMINFO:        "/logos/zoominfo.png",
  CALENDLY:        "/logos/calendly.png",
  SLACK:           "/logos/slack.png",
  AIRTABLE:        "/logos/airtable.png",
  NOTION:          "/logos/notion.png",
  GOOGLE_SHEETS:   "/logos/google-sheets.png",
};

function ConnectorLogo({ connector, size = 40 }: { connector: ConnectorMeta; size?: number }) {
  const src = LOGO_PATHS[connector.id];
  if (src) {
    return (
      <Image
        src={src}
        alt={connector.name}
        width={size}
        height={size}
        className="shrink-0 rounded-lg object-contain"
        style={{ height: size, width: size }}
      />
    );
  }
  const bgColor = connector.brandColor ?? "#6B7280";
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg text-white font-bold text-sm"
      style={{ backgroundColor: bgColor, height: size, width: size }}
    >
      {connector.name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── TrustNote ──────────────────────────────────────────

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
    <div className="flex items-center justify-between mt-1.5 px-0.5">
      <span className="flex items-center gap-1 text-[9px]">
        {state === "idle"    && <Lock        className="size-2.5 shrink-0 text-muted-foreground/60" />}
        {state === "loading" && <Spinner     className="size-2.5 animate-spin text-muted-foreground/60" />}
        {state === "valid"   && <CheckCircle className="size-2.5 text-green-500" weight="fill" />}
        {state === "invalid" && <XCircle     className="size-2.5 text-red-500" weight="fill" />}
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

// ─── Compact Connector Row ──────────────────────────────

function CompactConnectorRow({
  connector,
  integrations,
  setIntegrations,
}: {
  connector: ConnectorMeta;
  integrations: Integration[];
  setIntegrations: React.Dispatch<React.SetStateAction<Integration[]>>;
}) {
  const [expanded, setExpanded] = useState(false);
  const isConnected = integrations.some(
    (i) => i.type === connector.id && i.status === "ACTIVE",
  );
  const isRecommended = RECOMMENDED_IDS.has(connector.id);

  if (connector.authMethod === "coming_soon") {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/30 opacity-50">
        <ConnectorLogo connector={connector} size={24} />
        <span className="text-sm font-medium flex-1">{connector.name}</span>
        <Badge variant="outline" className="text-muted-foreground text-[10px]">Coming Soon</Badge>
      </div>
    );
  }

  if (connector.authMethod === "none") {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/30">
        <ConnectorLogo connector={connector} size={24} />
        <span className="text-sm font-medium flex-1">{connector.name}</span>
        <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30 text-[10px]">Built-in</Badge>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/30 overflow-hidden">
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 px-3 py-2.5 w-full text-left hover:bg-accent/30 transition-colors"
      >
        <ConnectorLogo connector={connector} size={24} />
        <span className="text-sm font-medium flex-1">{connector.name}</span>
        {isRecommended && !isConnected && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-500 bg-amber-500/10 rounded-full px-2 py-0.5">
            <Star className="size-2.5" weight="fill" />
            Recommended
          </span>
        )}
        {isConnected && (
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-green-500" />
            <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-[10px]">Connected</Badge>
          </span>
        )}
        {!isConnected && !expanded && (
          <span className="text-xs text-muted-foreground/50">Click to connect</span>
        )}
      </button>

      {/* Expanded content */}
      <div
        className="grid transition-all duration-200 ease-in-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden min-h-0">
          <div className="px-3 pb-3 pt-1 border-t border-border/20">
            <p className="text-xs text-muted-foreground mb-3">{connector.description}</p>
            <ConnectorForm
              connector={connector}
              integrations={integrations}
              setIntegrations={setIntegrations}
              isConnected={isConnected}
              onDone={() => setExpanded(false)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Connector Form (API key / OAuth / Composio) ────────

function ConnectorForm({
  connector,
  integrations,
  setIntegrations,
  isConnected,
  onDone,
}: {
  connector: ConnectorMeta;
  integrations: Integration[];
  setIntegrations: React.Dispatch<React.SetStateAction<Integration[]>>;
  isConnected: boolean;
  onDone: () => void;
}) {
  if (isConnected) {
    return (
      <DisconnectButton
        connector={connector}
        setIntegrations={setIntegrations}
        onDone={onDone}
      />
    );
  }

  switch (connector.authMethod) {
    case "api_key":
      return (
        <ApiKeyForm
          connector={connector}
          setIntegrations={setIntegrations}
          onDone={onDone}
        />
      );
    case "oauth":
      return (
        <OAuthButton
          connector={connector}
          setIntegrations={setIntegrations}
          onDone={onDone}
        />
      );
    case "composio":
      return (
        <ComposioButton
          connector={connector}
          setIntegrations={setIntegrations}
          onDone={onDone}
        />
      );
    default:
      return null;
  }
}

// ─── API Key Form ───────────────────────────────────────

function ApiKeyForm({
  connector,
  setIntegrations,
  onDone,
}: {
  connector: ConnectorMeta;
  setIntegrations: React.Dispatch<React.SetStateAction<Integration[]>>;
  onDone: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [validationState, setValidationState] = useState<ValidationState>("idle");
  const [validationError, setValidationError] = useState<string | undefined>();
  const validationAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => { validationAbortRef.current?.abort(); };
  }, []);

  const validateApiKey = useCallback(async (key: string) => {
    if (!key.trim()) return;
    validationAbortRef.current?.abort();
    const controller = new AbortController();
    validationAbortRef.current = controller;
    setValidationState("loading");
    try {
      const res = await fetch(`/api/integrations/${connector.id.toLowerCase()}`, {
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
  }, [connector.id]);

  const connect = useCallback(async () => {
    if (!apiKey.trim()) return;
    setConnecting(true);
    try {
      const res = await fetch(
        `/api/integrations/${connector.id.toLowerCase()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey, ...(validationState === "valid" ? { preValidated: true } : {}) }),
        },
      );
      const data = (await res.json()) as {
        error?: string;
        setup_actions?: string[];
        setup_warnings?: string[];
      };
      if (res.ok) {
        toast.success(`${connector.name} connected`);
        if (data.setup_actions) {
          for (const action of data.setup_actions) toast.info(action);
        }
        if (data.setup_warnings) {
          for (const warning of data.setup_warnings) toast.warning(warning, { duration: 8000 });
        }
        setIntegrations((prev) => [
          ...prev.filter((i) => i.type !== connector.id),
          { type: connector.id, status: "ACTIVE" },
        ]);
        setApiKey("");
        onDone();
      } else {
        toast.error(data.error || "Connection failed");
      }
    } catch {
      toast.error("Connection failed");
    } finally {
      setConnecting(false);
    }
  }, [apiKey, connector.id, connector.name, setIntegrations, validationState, onDone]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); void connect(); }}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={showKey ? "text" : "password"}
            placeholder={connector.placeholder ?? `${connector.name} API Key`}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              if (validationState !== "idle") {
                setValidationState("idle");
                setValidationError(undefined);
              }
            }}
            onBlur={() => { if (apiKey.trim()) void validateApiKey(apiKey); }}
            className={`pr-9 ${
              validationState === "valid"   ? "border-green-500 focus-visible:ring-green-500/20" :
              validationState === "invalid" ? "border-red-500 focus-visible:ring-red-500/20" : ""
            }`}
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            tabIndex={-1}
          >
            {showKey ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <Button type="submit" size="sm" disabled={connecting || !apiKey.trim()}>
          {connecting ? "Connecting..." : "Connect"}
        </Button>
      </div>
      <TrustNote toolId={connector.id} state={validationState} error={validationError} />
    </form>
  );
}

// ─── OAuth Button ───────────────────────────────────────

function OAuthButton({
  connector,
  setIntegrations,
  onDone,
}: {
  connector: ConnectorMeta;
  setIntegrations: React.Dispatch<React.SetStateAction<Integration[]>>;
  onDone: () => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const connect = useCallback(() => {
    const popup = window.open(
      `/api/integrations/${connector.id.toLowerCase()}/auth`,
      `${connector.id.toLowerCase()}-auth`,
      "width=600,height=700",
    );
    if (!popup) {
      toast.error("Popup blocked. Please allow popups for this site.");
      return;
    }
    setConnecting(true);
    pollRef.current = setInterval(async () => {
      if (!popup.closed) return;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      try {
        const res = await fetch("/api/trpc/integration.list");
        const data = await res.json();
        const list = data?.result?.data;
        if (Array.isArray(list)) {
          const match = list.find(
            (i: { type: string; status: string }) =>
              i.type === connector.id && i.status === "ACTIVE",
          );
          if (match) {
            setIntegrations((prev) => [
              ...prev.filter((i) => i.type !== connector.id),
              { type: connector.id, status: "ACTIVE" },
            ]);
            toast.success(`${connector.name} connected`);
            onDone();
          }
        }
      } catch { /* Best-effort */ }
      finally { setConnecting(false); }
    }, 500);
  }, [connector.id, connector.name, setIntegrations, onDone]);

  return (
    <Button size="sm" onClick={connect} disabled={connecting}>
      {connecting ? "Connecting..." : `Connect with ${connector.name}`}
    </Button>
  );
}

// ─── Composio OAuth Button ──────────────────────────────

function ComposioButton({
  connector,
  setIntegrations,
  onDone,
}: {
  connector: ConnectorMeta;
  setIntegrations: React.Dispatch<React.SetStateAction<Integration[]>>;
  onDone: () => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const authRes = await fetch(
        `/api/integrations/${connector.id.toLowerCase()}/composio/auth`,
      );
      if (!authRes.ok) {
        const msg = authRes.status === 503
          ? "This integration will be available soon"
          : "Connection failed. Please try again.";
        toast.error(msg);
        setConnecting(false);
        return;
      }
      const { redirectUrl, connectionId } = (await authRes.json()) as {
        redirectUrl: string;
        connectionId: string;
      };
      toast.info("You'll be redirected through a secure authorization page");
      const popup = window.open(
        redirectUrl,
        `${connector.id.toLowerCase()}-auth`,
        "width=600,height=700",
      );
      if (!popup) {
        toast.error("Popup blocked. Please allow popups for this site.");
        setConnecting(false);
        return;
      }
      pollRef.current = setInterval(async () => {
        if (!popup.closed) return;
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        try {
          const verifyRes = await fetch(
            `/api/integrations/${connector.id.toLowerCase()}/composio/verify?connectionId=${connectionId}`,
          );
          const data = (await verifyRes.json()) as {
            connected?: boolean;
            status?: string;
            error?: string;
          };
          if (data.connected) {
            setIntegrations((prev) => [
              ...prev.filter((i) => i.type !== connector.id),
              { type: connector.id, status: "ACTIVE" },
            ]);
            toast.success(`${connector.name} connected`);
            onDone();
          } else {
            toast.error(`${connector.name} connection not completed`);
          }
        } catch {
          toast.error("Could not verify connection");
        } finally {
          setConnecting(false);
        }
      }, 500);
    } catch {
      toast.error("Connection failed");
      setConnecting(false);
    }
  }, [connector.id, connector.name, setIntegrations, onDone]);

  return (
    <Button size="sm" onClick={() => void connect()} disabled={connecting}>
      {connecting ? "Connecting..." : `Connect with ${connector.name}`}
    </Button>
  );
}

// ─── Disconnect Button ──────────────────────────────────

function DisconnectButton({
  connector,
  setIntegrations,
  onDone,
}: {
  connector: ConnectorMeta;
  setIntegrations: React.Dispatch<React.SetStateAction<Integration[]>>;
  onDone: () => void;
}) {
  const disconnect = useCallback(async () => {
    const ok = window.confirm(
      `Disconnect ${connector.name}? Any automations using this integration will stop.`,
    );
    if (!ok) return;
    await fetch(`/api/integrations/${connector.id.toLowerCase()}`, {
      method: "DELETE",
    });
    setIntegrations((prev) => prev.filter((i) => i.type !== connector.id));
    toast.success(`${connector.name} disconnected`);
    onDone();
  }, [connector.id, connector.name, setIntegrations, onDone]);

  return (
    <Button variant="outline" size="sm" onClick={() => void disconnect()}>
      Disconnect
    </Button>
  );
}

// ─── Progress Indicator ─────────────────────────────────

function ProgressIndicator({ connected, total }: { connected: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">
        {connected} of {total} essentials
      </span>
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`size-2 rounded-full ${
              i < connected ? "bg-green-500" : "bg-muted-foreground/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  useEffect(() => {
    fetch("/api/trpc/integration.list")
      .then((r) => r.json())
      .then((data) => {
        if (data?.result?.data) setIntegrations(data.result.data);
      })
      .catch(() => {});
  }, []);

  // Group connectors by category
  const connectorsByCategory = new Map<ConnectorCategory, ConnectorMeta[]>();
  for (const connector of ALL_CONNECTORS) {
    const list = connectorsByCategory.get(connector.category) ?? [];
    list.push(connector);
    connectorsByCategory.set(connector.category, list);
  }

  // Essential connectors
  const essentialConnectors = ALL_CONNECTORS.filter(c =>
    ESSENTIAL_CATEGORIES.includes(c.category)
  );
  const espConnectors = essentialConnectors.filter(c => c.category === "esp");
  const leadDbConnectors = essentialConnectors.filter(c => c.category === "lead_database");

  // Progress
  const hasESP = integrations.some((i) =>
    espConnectors.some(c => c.id === i.type) && i.status === "ACTIVE",
  );
  const hasLeadDB = integrations.some((i) =>
    leadDbConnectors.some(c => c.id === i.type) && i.status === "ACTIVE",
  );
  const essentialsConnected = (hasESP ? 1 : 0) + (hasLeadDB ? 1 : 0);

  // Sort connectors within categories: connected first, then by tier
  function sortConnectors(connectors: ConnectorMeta[]) {
    return [...connectors].sort((a, b) => {
      const aConnected = integrations.some(i => i.type === a.id && i.status === "ACTIVE") ? 0 : 1;
      const bConnected = integrations.some(i => i.type === b.id && i.status === "ACTIVE") ? 0 : 1;
      if (aConnected !== bConnected) return aConnected - bConnected;
      if (a.authMethod === "coming_soon" && b.authMethod !== "coming_soon") return 1;
      if (a.authMethod !== "coming_soon" && b.authMethod === "coming_soon") return -1;
      return a.tier - b.tier;
    });
  }

  // Non-essential categories
  const nonEssentialCategories = CATEGORY_ORDER.filter(
    c => !ESSENTIAL_CATEGORIES.includes(c)
  );

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your tools to start prospecting.
        </p>
      </div>

      {/* Start Here section */}
      <div className="rounded-xl border-2 border-dashed border-indigo-500/30 bg-indigo-500/5 p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Start here</h2>
          <ProgressIndicator connected={essentialsConnected} total={2} />
        </div>

        {/* Email Sending */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Email Sending
          </h3>
          <div className="space-y-2">
            {sortConnectors(espConnectors).map((connector) => (
              <CompactConnectorRow
                key={connector.id}
                connector={connector}
                integrations={integrations}
                setIntegrations={setIntegrations}
              />
            ))}
          </div>
        </div>

        {/* Lead Database */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Lead Database
          </h3>
          <div className="space-y-2">
            {sortConnectors(leadDbConnectors).map((connector) => (
              <CompactConnectorRow
                key={connector.id}
                connector={connector}
                integrations={integrations}
                setIntegrations={setIntegrations}
              />
            ))}
          </div>
        </div>

        {essentialsConnected === 2 && (
          <div className="flex items-center gap-2 text-xs text-emerald-500 font-medium pt-1">
            <CheckCircle className="size-4" weight="fill" />
            Essentials connected — you&apos;re ready to prospect
          </div>
        )}
      </div>

      {/* Other categories */}
      {nonEssentialCategories.map((category) => {
        const connectors = connectorsByCategory.get(category);
        if (!connectors || connectors.length === 0) return null;
        return (
          <div key={category} className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {CATEGORY_LABELS[category]}
              </h2>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                {CATEGORY_DESCRIPTIONS[category]}
              </p>
            </div>
            <div className="space-y-2">
              {sortConnectors(connectors).map((connector) => (
                <CompactConnectorRow
                  key={connector.id}
                  connector={connector}
                  integrations={integrations}
                  setIntegrations={setIntegrations}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* CSV Import — always available */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Import
        </h2>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
                <FileArrowUp
                  size={24}
                  className="text-emerald-600"
                  weight="duotone"
                />
              </div>
              <div>
                <h2 className="text-sm font-semibold">CSV Import</h2>
                <p className="text-xs text-muted-foreground">
                  Import leads from a CSV file
                </p>
              </div>
            </div>
            <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30">
              Always available
            </Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}
