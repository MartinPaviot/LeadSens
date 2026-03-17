"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Card, Input, Badge } from "@leadsens/ui";
import { toast } from "sonner";
import { FileArrowUp } from "@phosphor-icons/react";
import type { ConnectorMeta, ConnectorCategory } from "@/server/lib/integrations/types";

// ─── Registry data (client-safe, imported at build time) ──

import {
  getAllConnectorMetas,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from "@/server/lib/integrations/registry";

// Pareto 80/20: only the ~20% of tools per category that cover ~80% of the market.
// Based on verified data: G2 reviews, Chrome Web Store installs, BuiltWith detections.
const PARETO_IDS = new Set([
  // ESP: Instantly (3,951 G2), Outreach (3,534 G2), Reply.io (1,527 G2), Lemlist (1,272 G2), Smartlead (fastest-growing)
  "INSTANTLY", "LEMLIST", "SMARTLEAD", "REPLY_IO", "OUTREACH",
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
  // Export: CSV, Airtable (15M MAU), Notion (100M users)
  "CSV", "AIRTABLE", "NOTION",
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
  const [connecting, setConnecting] = useState(false);

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
          body: JSON.stringify({ apiKey }),
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
  }, [apiKey, connector.id, connector.name, setIntegrations]);

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
        <div className="flex gap-2">
          <Input
            type="password"
            placeholder={connector.placeholder ?? `${connector.name} API Key`}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={connect}
            disabled={connecting || !apiKey.trim()}
          >
            {connecting ? "Connecting..." : "Connect"}
          </Button>
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
