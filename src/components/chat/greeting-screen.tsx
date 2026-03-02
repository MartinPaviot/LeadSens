"use client";

import { useState, useEffect } from "react";
import { ThreadPrimitive } from "@assistant-ui/react";
import Image from "next/image";
import Markdown from "react-markdown";
import { CheckCircle, CircleNotch } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { LeadSensComposer } from "./composer";

interface Integration {
  type: string;
  status: string;
  accountEmail?: string | null;
}

interface GreetingScreenProps {
  greetingContent: string;
  isStreaming: boolean;
}

export function GreetingScreen({
  greetingContent,
  isStreaming,
}: GreetingScreenProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch integration statuses on mount
  useEffect(() => {
    fetch("/api/trpc/integration.list")
      .then((r) => r.json())
      .then((data) => {
        if (data?.result?.data) setIntegrations(data.result.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);


  const isConnected = (type: string) =>
    integrations.some((i) => i.type === type && i.status === "ACTIVE");

  const handleInstantlyConnected = () => {
    setIntegrations((prev) => [
      ...prev.filter((i) => i.type !== "INSTANTLY"),
      { type: "INSTANTLY", status: "ACTIVE" },
    ]);
  };

  const showCards = !loading && !isConnected("INSTANTLY");

  return (
    <ThreadPrimitive.Root className="flex-1 flex flex-col min-h-0">
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto scrollbar-thin relative flex flex-col">
        {/* Background mesh */}
        <div className="pointer-events-none absolute inset-0 bg-leadsens-mesh" />

        {/* Content column — same max-width as thread.tsx */}
        <div className="max-w-[720px] mx-auto w-full px-4 md:px-6 py-6 flex-1 relative">
          {/* Chat bubble — mirrors assistant-message.tsx layout */}
          <div className="flex gap-3 items-start max-w-[85%] motion-safe:animate-[fade-in-up_0.3s_ease-out]">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="size-8 rounded-lg overflow-hidden">
                <img src="/L.svg" alt="LeadSens" className="size-8" />
              </div>
            </div>

            {/* Bubble */}
            <div className="rounded-[16px_16px_16px_4px] bg-secondary/90 backdrop-blur-sm px-4 py-2 min-w-0">
              <div className="text-[13.5px] leading-relaxed prose prose-sm dark:prose-invert max-w-none [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 prose-strong:font-semibold">
                <Markdown>{greetingContent}</Markdown>
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-primary/60 ml-0.5 align-middle rounded-sm animate-pulse" />
                )}
              </div>
            </div>
          </div>

          {/* Integration cards — indented to align with bubble content */}
          {showCards && (
            <div className="mt-6 ml-11 max-w-[85%] space-y-3 motion-safe:animate-[fade-in-up_0.4s_ease-out_400ms_both]">
              <InstantlyCard
                isConnected={isConnected("INSTANTLY")}
                onConnected={handleInstantlyConnected}
              />
            </div>
          )}
        </div>

        {/* Sticky composer */}
        <ThreadPrimitive.ViewportFooter className="sticky bottom-0">
          <LeadSensComposer />
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}

/* ─── Instantly Card ─── */

function InstantlyCard({
  isConnected,
  onConnected,
}: {
  isConnected: boolean;
  onConnected: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);

  const connect = async () => {
    if (!apiKey.trim()) return;
    setConnecting(true);
    try {
      const res = await fetch("/api/integrations/instantly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Instantly connected (${data.accounts} accounts)`);
        onConnected();
        setApiKey("");
        setExpanded(false);
      } else {
        toast.error(data.error || "Connection failed");
      }
    } catch {
      toast.error("Connexion echouee");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
            <Image src="/instantly.svg" alt="Instantly" width={20} height={20} />
          </div>
          <div>
            <p className="text-sm font-medium">Instantly</p>
            <p className="text-xs text-muted-foreground">
              Sourcing & email campaigns
            </p>
          </div>
        </div>

        {isConnected ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-600/20 border border-green-600/30 rounded-full px-2.5 py-1">
            <CheckCircle weight="fill" className="size-3.5" />
            Connected
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            Connect
          </Button>
        )}
      </div>

      {/* Expanded: API key input */}
      {expanded && !isConnected && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
          <Input
            type="password"
            placeholder="Instantly V2 API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && connect()}
            className="flex-1 h-9 text-sm"
            autoFocus
          />
          <Button
            size="sm"
            onClick={connect}
            disabled={connecting || !apiKey.trim()}
            className="h-9"
          >
            {connecting ? (
              <CircleNotch className="size-4 animate-spin" />
            ) : (
              "Submit"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

