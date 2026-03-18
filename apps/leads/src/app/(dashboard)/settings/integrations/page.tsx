"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button, Card, Input, Badge } from "@leadsens/ui";
import { toast } from "sonner";
import { CheckCircle, Eye, EyeSlash, FileArrowUp, Lock, Spinner, XCircle } from "@phosphor-icons/react";
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

// Pareto 80/20: only the ~20% of tools per category that cover ~80% of the market.
// Based on verified data: G2 reviews, Chrome Web Store installs, BuiltWith detections.
const PARETO_IDS = new Set([
  // ESP: Instantly (3,951 G2), Reply.io (1,527 G2), Lemlist (1,272 G2), Smartlead (fastest-growing)
  "INSTANTLY", "LEMLIST", "SMARTLEAD", "REPLY_IO",
  // Lead DB: Apollo (9,344 G2, 900K Chrome), ZoomInfo (9,033 G2), Seamless.AI (5,297 G2), Lusha (1,611 G2, 400K Chrome)
  "APOLLO", "ZOOMINFO", "SEAMLESS_AI", "LUSHA",
  // Verification: ZeroBounce (100K+ clients), MillionVerifier (70K+)
  "ZEROBOUNCE", "MILLIONVERIFIER",
  // CRM: HubSpot (13,549 G2, 1M Chrome), Salesforce (25,471 G2), Pipedrive (2,946 G2)
  "HUBSPOT", "SALESFORCE", "PIPEDRIVE",
  // Scheduling: Calendly (26.5% market, 20M users)
  "CALENDLY",
  // Notifications: Slack (42M DAU)
  "SLACK",
  // Export: CSV, Airtable (15M MAU), Notion (100M users), Google Sheets (1B+ users)
  "CSV", "AIRTABLE", "NOTION", "GOOGLE_SHEETS",
]);

const ALL_CONNECTORS = getAllConnectorMetas().filter(c => PARETO_IDS.has(c.id));

interface Integration {
  type: string;
  status: string;
  accountEmail?: string | null;
}

// ─── Letter Avatar ──────────────────────────────────────

function LetterAvatar({ name, color }: { name: string; color?: string }) {
  const bgColor = color ?? "#6B7280";
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white font-bold text-sm"
      style={{ backgroundColor: bgColor }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Generic API key integration card ─────────────────────

function ApiKeyCard({
  connector,
  integrations,
  setIntegrations,
}: {
  connector: ConnectorMeta;
  integrations: Integration[];
  setIntegrations: React.Dispatch<React.SetStateAction<Integration[]>>;
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

  const isConnected = integrations.some(
    (i) => i.type === connector.id && i.status === "ACTIVE",
  );

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
        // Show setup actions (e.g. "Webhook auto-configured")
        if (data.setup_actions) {
          for (const action of data.setup_actions) {
            toast.info(action);
          }
        }
        // Show warnings (e.g. "3 existing webhooks found")
        if (data.setup_warnings) {
          for (const warning of data.setup_warnings) {
            toast.warning(warning, { duration: 8000 });
          }
        }
        setIntegrations((prev) => [
          ...prev.filter((i) => i.type !== connector.id),
          { type: connector.id, status: "ACTIVE" },
        ]);
        setApiKey("");
      } else {
        toast.error(data.error || "Connection failed");
      }
    } catch {
      toast.error("Connection failed");
    } finally {
      setConnecting(false);
    }
  }, [apiKey, connector.id, connector.name, setIntegrations, validationState]);

  const disconnect = useCallback(async () => {
    await fetch(`/api/integrations/${connector.id.toLowerCase()}`, {
      method: "DELETE",
    });
    setIntegrations((prev) => prev.filter((i) => i.type !== connector.id));
    toast.success(`${connector.name} disconnected`);
  }, [connector.id, connector.name, setIntegrations]);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LetterAvatar name={connector.name} color={connector.brandColor} />
          <div>
            <h2 className="text-sm font-semibold">{connector.name}</h2>
            <p className="text-xs text-muted-foreground">
              {connector.description}
            </p>
          </div>
        </div>
        {isConnected ? (
          <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
            Connected
          </Badge>
        ) : (
          <Badge variant="outline">Not connected</Badge>
        )}
      </div>

      {isConnected ? (
        <Button variant="outline" size="sm" onClick={disconnect}>
          Disconnect
        </Button>
      ) : (
        <div>
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
            <Button
              size="sm"
              onClick={connect}
              disabled={connecting || !apiKey.trim()}
            >
              {connecting ? "Connecting..." : "Connect"}
            </Button>
          </div>
          <TrustNote toolId={connector.id} state={validationState} error={validationError} />
        </div>
      )}
    </Card>
  );
}

// ─── OAuth integration card ──────────────────────────────

function OAuthCard({
  connector,
  integrations,
  setIntegrations,
}: {
  connector: ConnectorMeta;
  integrations: Integration[];
  setIntegrations: React.Dispatch<React.SetStateAction<Integration[]>>;
}) {
  const isConnected = integrations.some(
    (i) => i.type === connector.id && i.status === "ACTIVE",
  );

  const disconnect = useCallback(async () => {
    await fetch(`/api/integrations/${connector.id.toLowerCase()}`, {
      method: "DELETE",
    });
    setIntegrations((prev) => prev.filter((i) => i.type !== connector.id));
    toast.success(`${connector.name} disconnected`);
  }, [connector.id, connector.name, setIntegrations]);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LetterAvatar name={connector.name} color={connector.brandColor} />
          <div>
            <h2 className="text-sm font-semibold">{connector.name}</h2>
            <p className="text-xs text-muted-foreground">
              {connector.description}
            </p>
          </div>
        </div>
        {isConnected ? (
          <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
            Connected
          </Badge>
        ) : (
          <Badge variant="outline">Not connected</Badge>
        )}
      </div>

      {isConnected ? (
        <Button variant="outline" size="sm" onClick={disconnect}>
          Disconnect
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={() => {
            window.location.href = `/api/integrations/${connector.id.toLowerCase()}/auth`;
          }}
        >
          Connect with {connector.name}
        </Button>
      )}
    </Card>
  );
}

// ─── Composio OAuth integration card ────────────────────

function ComposioOAuthCard({
  connector,
  integrations,
  setIntegrations,
}: {
  connector: ConnectorMeta;
  integrations: Integration[];
  setIntegrations: React.Dispatch<React.SetStateAction<Integration[]>>;
}) {
  const [connecting, setConnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isConnected = integrations.some(
    (i) => i.type === connector.id && i.status === "ACTIVE",
  );

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const authRes = await fetch(
        `/api/integrations/${connector.id.toLowerCase()}/composio/auth`,
      );
      if (!authRes.ok) {
        const msg = authRes.status === 503
          ? "Cette intégration sera disponible prochainement"
          : "Échec de connexion. Réessayez.";
        toast.error(msg);
        setConnecting(false);
        return;
      }
      const { redirectUrl, connectionId } = (await authRes.json()) as {
        redirectUrl: string;
        connectionId: string;
      };

      const popup = window.open(
        redirectUrl,
        `${connector.id.toLowerCase()}-composio`,
        "width=600,height=700",
      );

      if (!popup) {
        toast.error("Popup blocked. Please allow popups for this site.");
        setConnecting(false);
        return;
      }

      pollRef.current = setInterval(async () => {
        if (!popup.closed) return;

        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }

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
  }, [connector.id, connector.name, setIntegrations]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const disconnect = useCallback(async () => {
    await fetch(`/api/integrations/${connector.id.toLowerCase()}`, {
      method: "DELETE",
    });
    setIntegrations((prev) => prev.filter((i) => i.type !== connector.id));
    toast.success(`${connector.name} disconnected`);
  }, [connector.id, connector.name, setIntegrations]);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LetterAvatar name={connector.name} color={connector.brandColor} />
          <div>
            <h2 className="text-sm font-semibold">{connector.name}</h2>
            <p className="text-xs text-muted-foreground">
              {connector.description}
            </p>
          </div>
        </div>
        {isConnected ? (
          <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
            Connected
          </Badge>
        ) : (
          <Badge variant="outline">Not connected</Badge>
        )}
      </div>

      {isConnected ? (
        <Button variant="outline" size="sm" onClick={disconnect}>
          Disconnect
        </Button>
      ) : (
        <Button size="sm" onClick={connect} disabled={connecting}>
          {connecting ? "Connecting..." : `Connect with ${connector.name}`}
        </Button>
      )}
    </Card>
  );
}

// ─── Coming Soon card ────────────────────────────────────

function ComingSoonCard({ connector }: { connector: ConnectorMeta }) {
  return (
    <Card className="p-5 opacity-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LetterAvatar name={connector.name} color={connector.brandColor} />
          <div>
            <h2 className="text-sm font-semibold">{connector.name}</h2>
            <p className="text-xs text-muted-foreground">
              {connector.description}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-muted-foreground">
          Coming Soon
        </Badge>
      </div>
    </Card>
  );
}

// ─── Built-in card (no connection needed) ───────────────

function BuiltInCard({ connector }: { connector: ConnectorMeta }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LetterAvatar name={connector.name} color={connector.brandColor} />
          <div>
            <h2 className="text-sm font-semibold">{connector.name}</h2>
            <p className="text-xs text-muted-foreground">
              {connector.description}
            </p>
          </div>
        </div>
        <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30">
          Built-in
        </Badge>
      </div>
    </Card>
  );
}

// ─── Connector Card Router ───────────────────────────────

function ConnectorCard({
  connector,
  integrations,
  setIntegrations,
}: {
  connector: ConnectorMeta;
  integrations: Integration[];
  setIntegrations: React.Dispatch<React.SetStateAction<Integration[]>>;
}) {
  switch (connector.authMethod) {
    case "api_key":
      return (
        <ApiKeyCard
          connector={connector}
          integrations={integrations}
          setIntegrations={setIntegrations}
        />
      );
    case "oauth":
      return (
        <OAuthCard
          connector={connector}
          integrations={integrations}
          setIntegrations={setIntegrations}
        />
      );
    case "composio":
      return (
        <ComposioOAuthCard
          connector={connector}
          integrations={integrations}
          setIntegrations={setIntegrations}
        />
      );
    case "none":
      return <BuiltInCard connector={connector} />;
    case "coming_soon":
      return <ComingSoonCard connector={connector} />;
    default:
      return <ComingSoonCard connector={connector} />;
  }
}

// ─── Category Section ────────────────────────────────────

function CategorySection({
  category,
  connectors,
  integrations,
  setIntegrations,
}: {
  category: ConnectorCategory;
  connectors: ConnectorMeta[];
  integrations: Integration[];
  setIntegrations: React.Dispatch<React.SetStateAction<Integration[]>>;
}) {
  if (connectors.length === 0) return null;

  // Sort: connectable first, then coming_soon
  const sorted = [...connectors].sort((a, b) => {
    if (a.authMethod === "coming_soon" && b.authMethod !== "coming_soon")
      return 1;
    if (a.authMethod !== "coming_soon" && b.authMethod === "coming_soon")
      return -1;
    return a.tier - b.tier;
  });

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {CATEGORY_LABELS[category]}
      </h2>
      {sorted.map((connector) => (
        <ConnectorCard
          key={connector.id}
          connector={connector}
          integrations={integrations}
          setIntegrations={setIntegrations}
        />
      ))}
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

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your tools to start prospecting.
        </p>
      </div>

      {CATEGORY_ORDER.map((category) => {
        const connectors = connectorsByCategory.get(category);
        if (!connectors || connectors.length === 0) return null;
        return (
          <CategorySection
            key={category}
            category={category}
            connectors={connectors}
            integrations={integrations}
            setIntegrations={setIntegrations}
          />
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
