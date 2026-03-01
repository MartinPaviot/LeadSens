"use client";

import { useState, useEffect } from "react";
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

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [instantlyKey, setInstantlyKey] = useState("");
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetch("/api/trpc/integration.list")
      .then((r) => r.json())
      .then((data) => {
        if (data?.result?.data) setIntegrations(data.result.data);
      })
      .catch(() => {});
  }, []);

  const isConnected = (type: string) =>
    integrations.some((i) => i.type === type && i.status === "ACTIVE");

  const connectInstantly = async () => {
    if (!instantlyKey.trim()) return;
    setConnecting(true);
    try {
      const res = await fetch("/api/integrations/instantly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: instantlyKey }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Instantly connected (${data.accounts} accounts)`);
        setIntegrations((prev) => [
          ...prev.filter((i) => i.type !== "INSTANTLY"),
          { type: "INSTANTLY", status: "ACTIVE" },
        ]);
        setInstantlyKey("");
      } else {
        toast.error(data.error || "Connection failed");
      }
    } catch {
      toast.error("Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const disconnectInstantly = async () => {
    await fetch("/api/integrations/instantly", { method: "DELETE" });
    setIntegrations((prev) => prev.filter((i) => i.type !== "INSTANTLY"));
    toast.success("Instantly disconnected");
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your tools to start prospecting.
        </p>
      </div>

      {/* Instantly */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
              <Image src="/instantly.svg" alt="Instantly" width={24} height={24} />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Instantly</h2>
              <p className="text-xs text-muted-foreground">
                Sourcing & campagnes email
              </p>
            </div>
          </div>
          {isConnected("INSTANTLY") ? (
            <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
              Connected
            </Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </div>

        {isConnected("INSTANTLY") ? (
          <Button variant="outline" size="sm" onClick={disconnectInstantly}>
            Disconnect
          </Button>
        ) : (
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Instantly API V2 Key"
              value={instantlyKey}
              onChange={(e) => setInstantlyKey(e.target.value)}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={connectInstantly}
              disabled={connecting || !instantlyKey.trim()}
            >
              {connecting ? "Connecting..." : "Connect"}
            </Button>
          </div>
        )}
      </Card>

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
