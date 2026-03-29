"use client";

import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import { createParser } from "eventsource-parser";
import { AgentRuntimeProvider } from "@/components/chat/agent-runtime-provider";
import { ElevayThread } from "@/components/chat/thread";
import { GreetingLoader } from "@/components/chat/greeting-loader";
import { ThemeToggle } from "@/components/chat/theme-toggle";
import {
  AgentActivityContext,
  useSidebar,
  Button,
} from "@leadsens/ui";
import { SidebarSimple, Gear } from "@phosphor-icons/react";
import { SettingsModal } from "@/components/chat/settings-modal";
import type { SSEEventName, SSEEventPayload } from "@/lib/sse";
import {
  streamTsi07Audit,
  streamKga08Audit,
  streamOpt06Audit,
  streamPio05Audit,
  streamMdg11Audit,
  streamAlt12Audit,
} from "@/agents/seo-geo/client";
import type { SeoAgentProfile } from "@/agents/seo-geo/types";
import { SeoGreetingScreen, type SeoAction } from "./seo-greeting-screen";
import { SeoOnboardingModal } from "./seo-onboarding-modal";

// ─── Types ───────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ─── Constants ────────────────────────────────────────────

const MAX_RETRIES = 3;
const DEFAULT_RETRY_MS = 3000;
const SEO_PROFILE_KEY = "elevay_seo_profile";

const ACTION_MAP: Record<
  SeoAction,
  (
    conversationId: string,
    siteUrl: string,
    onChunk: (c: string) => void,
  ) => Promise<void>
> = {
  "tsi-audit": streamTsi07Audit,
  "kga-audit": streamKga08Audit,
  "opt-audit": streamOpt06Audit,
  "pio-audit": streamPio05Audit,
  "mdg-audit": streamMdg11Audit,
  "alt-audit": streamAlt12Audit,
};

// ─── Main Component ──────────────────────────────────────

export function SeoAgentChat() {
  const { state: sidebarState, toggleSidebar } = useSidebar();
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [seoProfile, setSeoProfile] = useState<SeoAgentProfile | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activityLabel, setActivityLabel] = useState<string | null>(null);
  const [hasUserSentMessage, setHasUserSentMessage] = useState(false);

  const conversationIdRef = useRef(generateId());
  const abortRef = useRef<AbortController | null>(null);
  const pendingContentRef = useRef("");
  const retryCountRef = useRef(0);
  const retryIntervalRef = useRef(DEFAULT_RETRY_MS);
  const updateScheduledRef = useRef(false);

  // ─── Load profile from localStorage ──────────────────

  useEffect(() => {
    const stored = localStorage.getItem(SEO_PROFILE_KEY);
    if (!stored) {
      setShowOnboarding(true);
    } else {
      setSeoProfile(JSON.parse(stored) as SeoAgentProfile);
    }
  }, []);

  const siteUrl = seoProfile?.siteUrl ?? "";

  // ─── Stream a SEO agent ───────────────────────────────

  const streamSeoAgent = useCallback(
    async (action: SeoAction) => {
      if (isStreaming || !siteUrl) return;

      setHasUserSentMessage(true);
      pendingContentRef.current = "";
      retryCountRef.current = 0;

      const convId = conversationIdRef.current;
      const assistantId = generateId();

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      setIsStreaming(true);
      setActivityLabel("Analyse en cours…");

      const streamFn = ACTION_MAP[action];

      try {
        const parser = createParser({
          onEvent(event) {
            const eventName = event.event as SSEEventName | undefined;
            if (!eventName) return;

            const data = JSON.parse(event.data) as unknown;

            switch (eventName) {
              case "text-delta": {
                const payload = data as SSEEventPayload["text-delta"];
                pendingContentRef.current += payload.delta;
                if (!updateScheduledRef.current) {
                  updateScheduledRef.current = true;
                  requestAnimationFrame(() => {
                    const content = pendingContentRef.current;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId ? { ...m, content } : m,
                      ),
                    );
                    updateScheduledRef.current = false;
                  });
                }
                break;
              }

              case "status": {
                const payload = data as SSEEventPayload["status"];
                setActivityLabel(payload.label);
                break;
              }

              case "finish":
                setActivityLabel(null);
                break;

              case "error": {
                const payload = data as SSEEventPayload["error"];
                setActivityLabel(null);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: `Erreur : ${payload.message}` }
                      : m,
                  ),
                );
                break;
              }

              default:
                break;
            }
          },
          onRetry(retryMs) {
            retryIntervalRef.current = retryMs;
          },
          onComment() {},
        });

        await streamFn(convId, siteUrl, (chunk) => parser.feed(chunk));

        if (pendingContentRef.current) {
          const finalContent = pendingContentRef.current;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: finalContent } : m,
            ),
          );
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "Une erreur est survenue. Réessayez." }
                : m,
            ),
          );
        }
      } finally {
        setIsStreaming(false);
        setActivityLabel(null);
      }
    },
    [isStreaming, siteUrl],
  );

  // ─── Regular chat (text input → /api/agents/chat) ─────

  const sendToServer = useCallback(
    async (chatMessages: ChatMessage[]) => {
      const convId = conversationIdRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      pendingContentRef.current = "";
      retryCountRef.current = 0;

      const assistantId = generateId();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      const attemptStream = async (): Promise<void> => {
        const res = await fetch("/api/agents/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: convId,
            messages: chatMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            isGreeting: false,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) throw new Error(`Chat failed: ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        const parser = createParser({
          onEvent(event) {
            const eventName = event.event as SSEEventName | undefined;
            if (!eventName) return;
            const data = JSON.parse(event.data) as unknown;

            if (eventName === "text-delta") {
              const payload = data as SSEEventPayload["text-delta"];
              pendingContentRef.current += payload.delta;
              if (!updateScheduledRef.current) {
                updateScheduledRef.current = true;
                requestAnimationFrame(() => {
                  const content = pendingContentRef.current;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content } : m,
                    ),
                  );
                  updateScheduledRef.current = false;
                });
              }
            } else if (eventName === "status") {
              const payload = data as SSEEventPayload["status"];
              setActivityLabel(payload.label);
            } else if (eventName === "finish") {
              setActivityLabel(null);
            }
          },
          onRetry(retryMs) {
            retryIntervalRef.current = retryMs;
          },
          onComment() {},
        });

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          parser.feed(decoder.decode(value, { stream: true }));
        }

        if (pendingContentRef.current) {
          const finalContent = pendingContentRef.current;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: finalContent } : m,
            ),
          );
        }
      };

      try {
        await attemptStream();
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          const retryDelay =
            retryIntervalRef.current *
            Math.pow(2, retryCountRef.current - 1);
          await new Promise((r) => setTimeout(r, retryDelay));
          try {
            await attemptStream();
          } catch {
            // ignore retry failure
          }
        }
      } finally {
        setIsStreaming(false);
        setActivityLabel(null);
        abortRef.current = null;
      }
    },
    [],
  );

  // ─── Send handler ─────────────────────────────────────

  const handleSend = useCallback(
    (content: string) => {
      if (!content.trim() || content.length > 500_000) return;
      setHasUserSentMessage(true);
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
      };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      sendToServer(newMessages);
    },
    [messages, sendToServer],
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleQuickReply = useCallback(
    (action: string) => {
      void streamSeoAgent(action as SeoAction);
    },
    [streamSeoAgent],
  );

  // Reset on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ─── Derived state ────────────────────────────────────

  const showGreetingScreen = !hasUserSentMessage && messages.length === 0;

  const activityValue = useMemo(
    () => ({
      label: activityLabel,
      steps: [],
      isThinking: false,
      isStreaming,
      setLabel: setActivityLabel,
    }),
    [activityLabel, isStreaming],
  );

  // ─── Render ───────────────────────────────────────────

  return (
    <AgentActivityContext.Provider value={activityValue}>
      {showOnboarding && (
        <SeoOnboardingModal
          open={showOnboarding}
          onComplete={(profile) => {
            setSeoProfile(profile);
            setShowOnboarding(false);
          }}
          onClose={() => setShowOnboarding(false)}
        />
      )}

      <div className="flex h-dvh" aria-label="SEO & GEO chat">
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="relative z-50 flex items-center justify-between px-4 py-1.5 border-b bg-background/95 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {sidebarState === "collapsed" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0"
                  onClick={toggleSidebar}
                >
                  <SidebarSimple className="size-3.5" />
                </Button>
              )}
              <span className="text-xs font-medium text-muted-foreground truncate">
                SEO & GEO
              </span>
              {seoProfile?.siteUrl && (
                <span className="text-xs text-muted-foreground/50 truncate hidden sm:block">
                  — {seoProfile.siteUrl}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => setShowSettings(true)}
                title="Settings"
              >
                <Gear className="size-3.5" />
              </Button>
            </div>
          </header>

          <AgentRuntimeProvider
            messages={messages}
            isStreaming={isStreaming}
            onSend={handleSend}
            onCancel={handleCancel}
          >
            {showGreetingScreen ? (
              <SeoGreetingScreen
                isStreaming={isStreaming}
                siteUrl={siteUrl || undefined}
                onQuickReply={handleQuickReply}
              />
            ) : messages.length === 0 ? (
              <GreetingLoader />
            ) : (
              <ElevayThread
                isStreaming={isStreaming}
                lastSuggestion={null}
                onSuggestionAction={handleQuickReply}
              />
            )}
          </AgentRuntimeProvider>
        </div>

        <div className="sr-only" aria-live="polite">
          {isStreaming && (activityLabel || "Agent en cours de réponse…")}
        </div>
      </div>

      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
    </AgentActivityContext.Provider>
  );
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 12);
}
