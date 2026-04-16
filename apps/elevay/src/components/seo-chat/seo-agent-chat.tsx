"use client";

import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import { createParser } from "eventsource-parser";
import { AgentRuntimeProvider } from "@/components/chat/agent-runtime-provider";
import { ElevayThread } from "@/components/chat/thread";
import { GreetingLoader } from "@/components/chat/greeting-loader";
import {
  AgentActivityContext,
  Button,
} from "@leadsens/ui";
import { Gear, Sun, Moon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { SeoSettingsModal } from "@/components/dashboard/seo-settings-modal";
import type { SSEEventName, SSEEventPayload } from "@/lib/sse";
import {
  streamTsi07Audit,
  streamKga08Audit,
  streamOpt06Audit,
  streamPio05Audit,
  streamMdg11Audit,
  streamAlt12Audit,
  streamWpw09Page,
  streamBsw10Article,
  NoConfigError,
  type NoConfigInfo,
} from "@/agents/seo-geo/client";
import { NoConfigBanner } from "@/components/ui-brand-intel/no-config-banner";
import type { SeoAgentProfile } from "@/agents/seo-geo/types";
import { SeoGreetingScreen, type SeoAction } from "./seo-greeting-screen";
import { SeoOnboardingModal } from "./seo-onboarding-modal";
import {
  SeoAgentForms,
  type Wpw09FormData,
  type Bsw10FormData,
  type Kga08FormData,
} from "./seo-agent-forms";

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

/** Actions that stream directly without a form */
const DIRECT_ACTION_MAP: Partial<
  Record<
    SeoAction,
    (
      conversationId: string,
      siteUrl: string,
      profile: SeoAgentProfile,
      onChunk: (c: string) => void,
    ) => Promise<void>
  >
> = {
  "tsi-audit": streamTsi07Audit,
  "opt-audit": streamOpt06Audit,
  "pio-audit": streamPio05Audit,
  "mdg-audit": streamMdg11Audit,
  "alt-audit": streamAlt12Audit,
};

/** Actions that require a form before streaming */
const FORM_ACTIONS: Record<string, "wpw09" | "bsw10" | "kga08"> = {
  "wpw09-create": "wpw09",
  "bsw10-create": "bsw10",
  "kga-audit": "kga08",
};

// ─── Main Component ──────────────────────────────────────

interface SeoAgentChatProps {
  embedded?: boolean;
}

export function SeoAgentChat({ embedded = false }: SeoAgentChatProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [seoProfile, setSeoProfile] = useState<SeoAgentProfile | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [noConfig, setNoConfig] = useState<NoConfigInfo | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activityLabel, setActivityLabel] = useState<string | null>(null);
  const [hasUserSentMessage, setHasUserSentMessage] = useState(false);
  const [openForm, setOpenForm] = useState<"wpw09" | "bsw10" | "kga08" | null>(null);

  const conversationIdRef = useRef(generateId());
  const abortRef = useRef<AbortController | null>(null);
  const pendingContentRef = useRef("");
  const retryCountRef = useRef(0);
  const retryIntervalRef = useRef(DEFAULT_RETRY_MS);
  const updateScheduledRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  // ─── Load profile from localStorage ──────────────────

  useEffect(() => {
    const stored = localStorage.getItem(SEO_PROFILE_KEY);
    if (stored) {
      setSeoProfile(JSON.parse(stored) as SeoAgentProfile);
    }
  }, []);

  const siteUrl = seoProfile?.siteUrl ?? "";

  // ─── Stream a SEO agent (generic streamer) ─────────────

  const runStream = useCallback(
    async (streamFn: (onChunk: (c: string) => void) => Promise<void>) => {
      if (isStreaming) return;

      setHasUserSentMessage(true);
      pendingContentRef.current = "";
      retryCountRef.current = 0;

      const assistantId = generateId();

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      setIsStreaming(true);
      setActivityLabel("Analysis in progress…");

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
                      ? { ...m, content: `Error: ${payload.message}` }
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

        await streamFn((chunk) => parser.feed(chunk));

        if (pendingContentRef.current) {
          const finalContent = pendingContentRef.current;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: finalContent } : m,
            ),
          );
        }
      } catch (err) {
        if (err instanceof NoConfigError) {
          setNoConfig(err.info);
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        } else if ((err as Error).name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "An error occurred. Please try again." }
                : m,
            ),
          );
        }
      } finally {
        setIsStreaming(false);
        setActivityLabel(null);
      }
    },
    [isStreaming],
  );

  // ─── Form submit handlers ─────────────────────────────

  const handleWpw09Submit = useCallback(
    (data: Wpw09FormData) => {
      if (!seoProfile) return;
      setOpenForm(null);
      const convId = conversationIdRef.current;
      void runStream((onChunk) =>
        streamWpw09Page(convId, seoProfile, {
          pageType: data.pageType,
          brief: data.brief,
          brandTone: data.brandTone,
          targetAudience: data.targetAudience,
          internalLinksAvailable: [],
          exportFormat: data.exportFormat,
          targetKeywords: data.targetKeywords.length > 0 ? data.targetKeywords : undefined,
        }, onChunk),
      );
    },
    [seoProfile, runStream],
  );

  const handleBsw10Submit = useCallback(
    (data: Bsw10FormData) => {
      if (!seoProfile) return;
      setOpenForm(null);
      const convId = conversationIdRef.current;
      void runStream((onChunk) =>
        streamBsw10Article(convId, seoProfile, {
          topic: data.topic,
          mode: data.mode,
          articleFormat: data.articleFormat,
          targetAudience: data.targetAudience,
          expertiseLevel: "intermediate",
          objective: "traffic",
          brandTone: data.brandTone,
          cta: data.cta,
          internalLinksAvailable: [],
          targetKeywords: data.targetKeywords.length > 0 ? data.targetKeywords : undefined,
        }, onChunk),
      );
    },
    [seoProfile, runStream],
  );

  const handleKga08Submit = useCallback(
    (data: Kga08FormData) => {
      if (!seoProfile || !siteUrl) return;
      setOpenForm(null);
      const convId = conversationIdRef.current;
      void runStream((onChunk) =>
        streamKga08Audit(convId, siteUrl, seoProfile, onChunk, data.seedKeywords),
      );
    },
    [seoProfile, siteUrl, runStream],
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
      const seoAction = action as SeoAction;

      // Actions that require a form first
      const formType = FORM_ACTIONS[seoAction];
      if (formType) {
        setOpenForm(formType);
        return;
      }

      // Direct streaming actions
      const directFn = DIRECT_ACTION_MAP[seoAction];
      if (directFn && siteUrl && seoProfile) {
        const convId = conversationIdRef.current;
        void runStream((onChunk) => directFn(convId, siteUrl, seoProfile, onChunk));
      }
    },
    [siteUrl, seoProfile, runStream],
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

      <SeoAgentForms
        open={openForm}
        onClose={() => setOpenForm(null)}
        onSubmitWpw09={handleWpw09Submit}
        onSubmitBsw10={handleBsw10Submit}
        onSubmitKga08={handleKga08Submit}
      />

      <div className={embedded ? "flex h-full w-full flex-col" : "flex h-dvh"} aria-label="SEO & GEO chat">
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header — matches dashboard-shell topbar */}
          <header className="flex shrink-0 items-center justify-between border-b border-border/60 bg-background px-4 py-3 sm:px-6 md:px-8">
            <h1 className="text-sm font-semibold text-foreground sm:text-base">SEO & GEO</h1>
            <div className="flex items-center gap-1.5">
              {mounted && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setShowSettings(true)}
                title="Settings"
              >
                <Gear size={16} />
              </Button>
            </div>
          </header>

          {noConfig && (
            <div className="px-4 pt-4 sm:px-6 md:px-8">
              <NoConfigBanner missing={noConfig.missing} tab={noConfig.tab} agentName="SEO & GEO" />
            </div>
          )}

          {showGreetingScreen ? (
            <SeoGreetingScreen
              isStreaming={isStreaming}
              siteUrl={siteUrl || undefined}
              onQuickReply={handleQuickReply}
              onSend={handleSend}
            />
          ) : (
            <AgentRuntimeProvider
              messages={messages}
              isStreaming={isStreaming}
              onSend={handleSend}
              onCancel={handleCancel}
            >
              {messages.length === 0 ? (
                <GreetingLoader />
              ) : (
                <ElevayThread
                  isStreaming={isStreaming}
                  lastSuggestion={null}
                  onSuggestionAction={handleQuickReply}
                />
              )}
            </AgentRuntimeProvider>
          )}
        </div>

        <div className="sr-only" aria-live="polite">
          {isStreaming && (activityLabel || "Agent responding…")}
        </div>
      </div>

      <SeoSettingsModal open={showSettings} onOpenChange={setShowSettings} />
    </AgentActivityContext.Provider>
  );
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 12);
}
