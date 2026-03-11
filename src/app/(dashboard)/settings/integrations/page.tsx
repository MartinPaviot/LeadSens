"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileArrowUp } from "@phosphor-icons/react";

interface Integration {
  type: string;
  status: string;
  accountEmail?: string | null;
}

// ─── Generic API key integration card ─────────────────────

function ApiKeyCard({
  type,
  name,
  description,
  placeholder,
  icon,
  integrations,
  setIntegrations,
  successMessage,
}: {
  type: string;
  name: string;
  description: string;
  placeholder: string;
  icon: React.ReactNode;
  integrations: Integration[];
  setIntegrations: React.Dispatch<React.SetStateAction<Integration[]>>;
  successMessage?: (data: Record<string, unknown>) => string;
}) {
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);

  const isConnected = integrations.some(
    (i) => i.type === type && i.status === "ACTIVE",
  );

  const connect = useCallback(async () => {
    if (!apiKey.trim()) return;
    setConnecting(true);
    try {
      const res = await fetch(`/api/integrations/${type.toLowerCase()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (res.ok) {
        const msg = successMessage ? successMessage(data) : `${name} connected`;
        toast.success(msg);
        setIntegrations((prev) => [
          ...prev.filter((i) => i.type !== type),
          { type, status: "ACTIVE" },
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
  }, [apiKey, type, name, successMessage, setIntegrations]);

  const disconnect = useCallback(async () => {
    await fetch(`/api/integrations/${type.toLowerCase()}`, { method: "DELETE" });
    setIntegrations((prev) => prev.filter((i) => i.type !== type));
    toast.success(`${name} disconnected`);
  }, [type, name, setIntegrations]);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h2 className="text-sm font-semibold">{name}</h2>
            <p className="text-xs text-muted-foreground">{description}</p>
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
            placeholder={placeholder}
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

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your tools to start prospecting.
        </p>
      </div>

      {/* Instantly */}
      <ApiKeyCard
        type="INSTANTLY"
        name="Instantly"
        description="Sourcing & email campaigns"
        placeholder="Instantly API V2 Key"
        icon={
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
            <Image src="/instantly.svg" alt="Instantly" width={24} height={24} />
          </div>
        }
        integrations={integrations}
        setIntegrations={setIntegrations}
        successMessage={(data) => `Instantly connected (${data.accounts ?? 0} accounts)`}
      />

      {/* Apollo */}
      <ApiKeyCard
        type="APOLLO"
        name="Apollo"
        description="Contact enrichment & email finding"
        placeholder="Apollo API Key"
        icon={
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950">
            <Image src="/apollo.svg" alt="Apollo" width={24} height={24} />
          </div>
        }
        integrations={integrations}
        setIntegrations={setIntegrations}
      />

      {/* ZeroBounce */}
      <ApiKeyCard
        type="ZEROBOUNCE"
        name="ZeroBounce"
        description="Email verification & bounce protection"
        placeholder="ZeroBounce API Key"
        icon={
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950">
            <Image src="/zerobounce.svg" alt="ZeroBounce" width={24} height={24} />
          </div>
        }
        integrations={integrations}
        setIntegrations={setIntegrations}
        successMessage={(data) =>
          `ZeroBounce connected${data.credits ? ` (${data.credits} credits)` : ""}`
        }
      />

      {/* Smartlead */}
      <ApiKeyCard
        type="SMARTLEAD"
        name="Smartlead"
        description="Email campaigns & sequences"
        placeholder="Smartlead API Key"
        icon={
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950">
            <Image src="/smartlead.svg" alt="Smartlead" width={24} height={24} />
          </div>
        }
        integrations={integrations}
        setIntegrations={setIntegrations}
      />

      {/* Lemlist */}
      <ApiKeyCard
        type="LEMLIST"
        name="Lemlist"
        description="Email campaigns & outreach sequences"
        placeholder="Lemlist API Key"
        icon={
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950">
            <Image src="/lemlist.svg" alt="Lemlist" width={24} height={24} />
          </div>
        }
        integrations={integrations}
        setIntegrations={setIntegrations}
      />

      {/* CSV Import */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
              <FileArrowUp size={24} className="text-emerald-600" weight="duotone" />
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
  );
}
