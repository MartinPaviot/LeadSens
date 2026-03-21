"use client";

import {
  useCallback,
  useRef,
  useState,
  useEffect,
  useMemo,
} from "react";
import { createParser } from "eventsource-parser";
import { AgentRuntimeProvider } from "./agent-runtime-provider";
import { ElevayThread } from "./thread";
import { GreetingLoader } from "./greeting-loader";
import { GreetingScreen } from "./greeting-screen";
import { ThemeToggle } from "./theme-toggle";
import { MessageActionsProvider, type MessageActions, AgentActivityContext, type AgentActivityContextValue, type ThinkingStep, useSidebar, Button } from "@leadsens/ui";
import { useConversations } from "@/components/conversation-provider";
import { SidebarSimple } from "@phosphor-icons/react";
import type { SSEEventName, SSEEventPayload } from "@/lib/sse";
import { trpc } from "@/lib/trpc-client";
import { OnboardingModal } from "./onboarding-modal";
import { BpiProgressContext, type ModuleItem, type ExportButton } from "./bpi-progress-context";
import type { BpiOutput } from "@/agents/bpi-01/types";

// ─── Types ───────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ─── Constants ────────────────────────────────────────────

const MAX_RETRIES = 3;
const DEFAULT_RETRY_MS = 3000;

const EXPORT_PATTERNS: Record<string, "pdf" | "gdoc" | "slides"> = {
  "exporte en pdf": "pdf",
  "exporter en pdf": "pdf",
  "exporte en google docs": "gdoc",
  "exporter en google docs": "gdoc",
  "génère les slides": "slides",
  "générer les slides": "slides",
  "génère des slides": "slides",
};

// ─── BPI summary builder ─────────────────────────────────

function buildBpiSummary(bpiOutput: BpiOutput, brandName: string): string {
  const { scores, top_risks, quick_wins, benchmark_data } = bpiOutput;
  const riskLine = top_risks[0]?.description ?? "Aucun risque critique identifié";
  const winLine = quick_wins[0]?.action ?? "Aucun quick win identifié";
  let benchmarkLine: string;
  if (benchmark_data?.radar && benchmark_data.radar.length > 0) {
    const top = benchmark_data.radar.reduce((a, b) =>
      a.serp_share + a.seo_score > b.serp_share + b.seo_score ? a : b,
    );
    benchmarkLine = `${top.name} domine en visibilité SERP (${top.serp_share}/100)`;
  } else if (benchmark_data) {
    benchmarkLine = `Score concurrentiel : ${benchmark_data.competitive_score}/100`;
  } else {
    benchmarkLine = "Données benchmark non disponibles";
  }
  return `🔍 **Audit terminé — ${brandName}**\nScore global : **${scores.global}/100**\n\nPoints clés :\n- ${riskLine}\n- ${winLine}\n- ${benchmarkLine}`;
}

// ─── Main Component ──────────────────────────────────────

export default function AgentChat() {
  const {
    activeId,
    chatKey,
    conversations,
    registerNewConversation,
    refreshConversations,
  } = useConversations();

  const activeTitle = conversations.find((c) => c.id === activeId)?.title;
  const { state: sidebarState, toggleSidebar } = useSidebar();

  const { data: brandProfile, refetch: refetchProfile } = trpc.brandProfile.get.useQuery();
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activityLabel, setActivityLabel] = useState<string | null>(null);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [hasUserSentMessage, setHasUserSentMessage] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [bpiModules, setBpiModules] = useState<ModuleItem[] | null>(null);
  const [bpiExpanded, setBpiExpanded] = useState(false);
  const [bpiExportButton, setBpiExportButton] = useState<Omit<ExportButton, "assistantId"> | null>(null);
  const bpiAuditMessageIdRef = useRef<string | null>(null);

  const conversationIdRef = useRef(generateId());
  const abortRef = useRef<AbortController | null>(null);
  const pendingContentRef = useRef("");
  const pendingBpiRef = useRef(false);
  // Ref to break forward-reference: streamBpiAudit calls handleExportCommand defined later
  const handleExportCommandRef = useRef<(userText: string, format: "pdf" | "gdoc" | "slides") => Promise<void>>(
    async () => { /* populated after handleExportCommand is defined */ },
  );
  // Tracks whether brand profile is confirmed absent (avoids Prisma type in useCallback deps)
  const noBrandProfileRef = useRef(false);
  const exportFormatRef = useRef<string | undefined>(undefined);
  const updateScheduledRef = useRef(false);
  const isNewConversationRef = useRef(true);
  const retryCountRef = useRef(0);
  const retryIntervalRef = useRef(DEFAULT_RETRY_MS);

  const prevChatKeyRef = useRef(chatKey);
  const initializedRef = useRef(false);

  // ─── Conversation switch / init ────────────────────────

  useEffect(() => {
    const isInit = !initializedRef.current;
    const isSwitching = prevChatKeyRef.current !== chatKey;
    prevChatKeyRef.current = chatKey;

    if (!isInit && !isSwitching) return;
    initializedRef.current = true;

    abortRef.current?.abort();

    setMessages([]);
    setIsStreaming(false);
    setActivityLabel(null);
    setThinkingSteps([]);
    setHasUserSentMessage(false);
    setBpiExportButton(null);
    bpiAuditMessageIdRef.current = null;
    pendingContentRef.current = "";
    updateScheduledRef.current = false;
    retryCountRef.current = 0;
    retryIntervalRef.current = DEFAULT_RETRY_MS;

    if (activeId) {
      conversationIdRef.current = activeId;
      isNewConversationRef.current = false;
      setIsLoadingHistory(true);

      (async () => {
        try {
          const res = await fetch(
            `/api/trpc/conversation.getMessages?input=${encodeURIComponent(
              JSON.stringify({ conversationId: activeId }),
            )}`,
          );
          const data = await res.json();
          const dbMessages = data?.result?.data ?? [];

          const chatMessages: ChatMessage[] = dbMessages.map(
            (m: { id: string; role: string; content: string }) => ({
              id: m.id,
              role: m.role.toLowerCase() as "user" | "assistant",
              content: m.content,
            }),
          );

          setMessages(chatMessages);
          if (chatMessages.some((m) => m.role === "user")) {
            setHasUserSentMessage(true);
          }
        } catch (err) {
          console.error("Failed to load conversation:", err);
        } finally {
          setIsLoadingHistory(false);
        }
      })();
    } else {
      const newId = generateId();
      conversationIdRef.current = newId;
      isNewConversationRef.current = true;
      setIsLoadingHistory(false);
      sendGreeting(newId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatKey, activeId]);

  // ─── Greeting helper ──────────────────────────────────

  const sendGreeting = useCallback(
    async (convId: string) => {
      setIsStreaming(true);
      const assistantId = generateId();

      try {
        const res = await fetch("/api/agents/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: convId,
            messages: [],
            isGreeting: true,
          }),
        });

        if (!res.ok) throw new Error(`Greeting failed: ${res.status}`);
        const data = await res.json();
        const greetingText = data.greeting ?? "";

        setMessages([{ id: assistantId, role: "assistant", content: greetingText }]);
      } catch {
        setMessages([
          {
            id: assistantId,
            role: "assistant",
            content:
              "Hey, welcome to Elevay! I'm your AI marketing assistant. Tell me about your marketing goals and I'll help you build effective strategies.\n\nWhat would you like to work on today?",
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [],
  );

  // ─── Stream to server ─────────────────────────────────

  const sendToServer = useCallback(
    async (chatMessages: ChatMessage[]) => {
      const convId = conversationIdRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      setThinkingSteps([]);
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

        if (!res.ok || !res.body) {
          throw new Error(`Chat failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        const parser = createParser({
          onEvent(event) {
            const eventName = event.event as SSEEventName | undefined;
            if (!eventName) return;

            const data = JSON.parse(event.data);

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
                console.error("Stream error:", payload.message);
                setActivityLabel(null);
                break;
              }

              case "stream-start":
                if (isNewConversationRef.current) {
                  isNewConversationRef.current = false;
                  registerNewConversation(convId);
                }
                break;
              case "stream-end":
              case "step-complete":
              case "tool-input-start":
              case "tool-input-available":
              case "tool-output-available":
                break;
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
        if ((err as Error).name === "AbortError") {
          // User cancelled
        } else if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          const delay =
            retryIntervalRef.current *
            Math.pow(2, retryCountRef.current - 1);
          await new Promise((r) => setTimeout(r, delay));
          try {
            await attemptStream();
          } catch (retryErr) {
            if ((retryErr as Error).name !== "AbortError") {
              console.error("Chat retry failed:", retryErr);
            }
          }
        }
      } finally {
        setIsStreaming(false);
        setActivityLabel(null);
        abortRef.current = null;
        refreshConversations();
      }
    },
    [registerNewConversation, refreshConversations],
  );

  // ─── Brand profile — auto-open modal ─────────────────

  useEffect(() => {
    noBrandProfileRef.current = brandProfile === null;
    exportFormatRef.current = brandProfile?.exportFormat ?? undefined;
    if (brandProfile === null) {
      setShowOnboarding(true);
    }
  }, [brandProfile]);

  // ─── BPI-01 audit stream ──────────────────────────────

  const streamBpiAudit = useCallback(async () => {
    if (isStreaming) return;

    if (noBrandProfileRef.current) {
      pendingBpiRef.current = true;
      setShowOnboarding(true);
      return;
    }
    setHasUserSentMessage(true);
    setThinkingSteps([]);
    pendingContentRef.current = "";
    retryCountRef.current = 0;

    const convId = conversationIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);

    const assistantId = generateId();
    setMessages((prev) => [
      ...prev,
      { id: generateId(), role: "user", content: "🔍 Auditer ma marque" },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    // Initialize module progress UI
    const MODULE_LABELS = ["SERP", "Presse", "YouTube", "Social", "SEO", "Benchmark"];
    setBpiModules(MODULE_LABELS.map((label) => ({ label, status: "idle" as const })));
    setBpiExpanded(false);

    let capturedBpiOutput: BpiOutput | null = null;
    let capturedBrandName = "";

    try {
      const res = await fetch("/api/agents/bmi/bpi-01", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`BPI-01 failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parser = createParser({
        onEvent(event) {
          const eventName = event.event as SSEEventName | undefined;
          if (!eventName) return;
          const data = JSON.parse(event.data) as SSEEventPayload[typeof eventName];

          if (eventName === "text-delta") {
            // Ignore markdown delta — we show AgentProgress until finally, then buildBpiSummary
          } else if (eventName === "result") {
            const payload = data as SSEEventPayload["result"];
            capturedBpiOutput = payload.bpiOutput as BpiOutput;
            capturedBrandName = payload.brandName;
          } else if (eventName === "status") {
            const payload = data as SSEEventPayload["status"];
            if (payload.step !== undefined) {
              const idx = payload.step - 1;
              let status: "running" | "done" | "failed";
              if (payload.label.includes("en cours")) status = "running";
              else if (payload.label.includes("✓")) status = "done";
              else status = "failed";

              setBpiModules((prev) => {
                if (!prev) return prev;
                const next = [...prev];
                next[idx] = { ...next[idx]!, status };
                return next;
              });
            }
          } else if (eventName === "error") {
            setBpiModules(null);
            const payload = data as SSEEventPayload["error"];
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: `⚠️ ${payload.message}` }
                  : m,
              ),
            );
          }
        },
        onRetry(ms) {
          retryIntervalRef.current = ms;
        },
        onComment() {},
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") console.error("BPI-01 stream error:", err);
    } finally {
      setIsStreaming(false);
      setActivityLabel(null);
      setBpiModules(null);
      abortRef.current = null;
      if (isNewConversationRef.current) {
        isNewConversationRef.current = false;
        registerNewConversation(convId);
      }
      refreshConversations();

      // Build short summary (or fallback) and update the single assistant bubble
      const summary = capturedBpiOutput
        ? buildBpiSummary(capturedBpiOutput, capturedBrandName)
        : "⚠️ L'audit s'est terminé mais les données n'ont pas pu être récupérées.";

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: summary } : m)),
      );

      bpiAuditMessageIdRef.current = assistantId;

      const fmt = exportFormatRef.current;
      if (fmt === "gdoc" && capturedBpiOutput) {
        try {
          const res = await fetch("/api/agents/bmi/export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ format: "gdoc" }),
          });
          const result = await res.json() as { type: string; url?: string };
          if (result.type === "gdoc" && result.url) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: summary + `\n\n📄 [Ouvrir dans Google Docs →](${result.url})` }
                  : m,
              ),
            );
            return;
          }
        } catch { /* fall through to PDF button */ }
      }

      // PDF (default) or gdoc fallback: show inline export button
      setBpiExportButton({
        label: "📥 Télécharger le rapport (PDF)",
        onClick: async () => {
          setBpiExportButton(null);
          try {
            const res = await fetch("/api/agents/bmi/export", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ format: "pdf" }),
            });
            const result = await res.json() as { type: string; dataUrl?: string; filename?: string; message?: string };
            if (result.type === "pdf" && result.dataUrl && result.filename) {
              const a = document.createElement("a");
              a.href = result.dataUrl;
              a.download = result.filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: summary + "\n\n📥 Téléchargement du PDF en cours." }
                    : m,
                ),
              );
            } else {
              const errMsg = result.message ?? "Export non disponible.";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: summary + `\n\n⚠️ ${errMsg}` }
                    : m,
                ),
              );
            }
          } catch (err) {
            console.error("[BPI PDF export]", err);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: summary + "\n\n⚠️ Erreur lors du téléchargement." }
                  : m,
              ),
            );
          }
        },
      });
    }
  }, [isStreaming, registerNewConversation, refreshConversations]);

  // ─── Brand profile — auto-launch + complete ───────────

  // Auto-launch BPI-01 after onboarding completes (if triggered by the button)
  useEffect(() => {
    if (!noBrandProfileRef.current && !showOnboarding && pendingBpiRef.current) {
      pendingBpiRef.current = false;
      void streamBpiAudit();
    }
  }, [showOnboarding, streamBpiAudit]);

  const handleOnboardingComplete = useCallback(async () => {
    await refetchProfile();
    setShowOnboarding(false);
  }, [refetchProfile]);

  const handleQuickReply = useCallback(
    (type: string) => {
      if (type === "bpi-audit") void streamBpiAudit();
    },
    [streamBpiAudit],
  );

  // ─── Export commands ──────────────────────────────────

  const handleExportCommand = useCallback(
    async (userText: string, format: "pdf" | "gdoc" | "slides") => {
      setHasUserSentMessage(true);
      const assistantId = generateId();
      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: "user", content: userText },
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setIsStreaming(true);

      try {
        const res = await fetch("/api/agents/bmi/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format }),
        });
        const result = await res.json() as {
          type: "pdf" | "gdoc" | "download" | "link" | "error";
          dataUrl?: string;
          url?: string;
          message?: string;
          filename?: string;
        };

        if (result.type === "pdf" && result.dataUrl && result.filename) {
          const a = document.createElement("a");
          a.href = result.dataUrl;
          a.download = result.filename;
          a.click();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "📥 Téléchargement du PDF en cours." }
                : m,
            ),
          );
        } else if (result.type === "gdoc" && result.url) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `📄 [Ouvrir dans Google Docs →](${result.url})` }
                : m,
            ),
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: result.message ?? "Export non disponible." }
                : m,
            ),
          );
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: "⚠️ Erreur lors de l'export." } : m,
          ),
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [],
  );

  // Keep ref in sync so streamBpiAudit can call handleExportCommand without circular deps
  handleExportCommandRef.current = handleExportCommand;

  // ─── Send handler ─────────────────────────────────────

  const handleSend = useCallback(
    (content: string) => {
      if (!content.trim() || content.length > 500_000) return;

      const normalized = content.trim().toLowerCase();
      const exportFormat = EXPORT_PATTERNS[normalized];
      if (exportFormat) {
        void handleExportCommand(content.trim(), exportFormat);
        return;
      }

      setHasUserSentMessage(true);
      setThinkingSteps([]);
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
      };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      sendToServer(newMessages);
    },
    [messages, sendToServer, handleExportCommand],
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ─── Message actions ──────────────────────────────────

  const handleEdit = useCallback(
    (messageId: string, newContent: string) => {
      if (isStreaming) return;
      const msgIndex = messages.findIndex((m) => m.id === messageId);
      if (msgIndex === -1) return;

      const truncated = messages.slice(0, msgIndex + 1).map((m, i) =>
        i === msgIndex ? { ...m, content: newContent } : m,
      );
      setMessages(truncated);
      setHasUserSentMessage(true);
      setThinkingSteps([]);
      sendToServer(truncated);
    },
    [messages, isStreaming, sendToServer],
  );

  const handleRegenerate = useCallback(
    (messageId: string) => {
      if (isStreaming) return;
      const msgIndex = messages.findIndex((m) => m.id === messageId);
      if (msgIndex === -1) return;

      const truncated = messages.slice(0, msgIndex);
      if (truncated.length === 0) return;

      setMessages(truncated);
      setThinkingSteps([]);
      sendToServer(truncated);
    },
    [messages, isStreaming, sendToServer],
  );

  const handleFeedback = useCallback(
    (messageId: string, type: "THUMBS_UP" | "THUMBS_DOWN") => {
      const convId = conversationIdRef.current;
      fetch("/api/agents/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, conversationId: convId, type }),
      }).catch(() => {});
    },
    [],
  );

  const messageActions = useMemo<MessageActions>(
    () => ({
      onEdit: handleEdit,
      onRegenerate: handleRegenerate,
      onFeedback: handleFeedback,
    }),
    [handleEdit, handleRegenerate, handleFeedback],
  );

  // ─── Derived state ────────────────────────────────────

  const isLoadingGreeting = !isLoadingHistory && messages.length === 0;
  const showGreetingScreen =
    !isLoadingHistory && !hasUserSentMessage && messages.length > 0;

  const activityValue = useMemo(
    () => ({
      label: activityLabel,
      steps: thinkingSteps,
      isThinking:
        isStreaming && thinkingSteps.some((s) => s.status === "running"),
      isStreaming: isStreaming && bpiModules === null,
      setLabel: setActivityLabel,
    }),
    [activityLabel, thinkingSteps, isStreaming, bpiModules],
  );

  // ─── Render ───────────────────────────────────────────

  const bpiContextValue = useMemo(
    () => ({
      modules: bpiModules,
      isExpanded: bpiExpanded,
      toggle: () => setBpiExpanded((e) => !e),
      exportButton: bpiExportButton && bpiAuditMessageIdRef.current
        ? { assistantId: bpiAuditMessageIdRef.current, ...bpiExportButton }
        : null,
    }),
    [bpiModules, bpiExpanded, bpiExportButton],
  );

  return (
    <BpiProgressContext.Provider value={bpiContextValue}>
    <AgentActivityContext.Provider value={activityValue}>
      <div className="flex h-dvh" aria-label="Agent chat">
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
                {activeTitle || "New conversation"}
              </span>
            </div>
            <ThemeToggle />
          </header>

          <MessageActionsProvider value={messageActions}>
            <AgentRuntimeProvider
              messages={messages}
              isStreaming={isStreaming}
              onSend={handleSend}
              onCancel={handleCancel}
            >
              {isLoadingHistory ? (
                <GreetingLoader />
              ) : isLoadingGreeting ? (
                <GreetingLoader />
              ) : showGreetingScreen ? (
                <GreetingScreen isStreaming={isStreaming} onQuickReply={handleQuickReply} />
              ) : (
                <ElevayThread isStreaming={isStreaming} />
              )}
            </AgentRuntimeProvider>
          </MessageActionsProvider>
        </div>

        <div className="sr-only" aria-live="polite">
          {isStreaming &&
            (activityLabel || "Agent is generating a response...")}
        </div>
      </div>

      <OnboardingModal open={showOnboarding} onComplete={handleOnboardingComplete} />
    </AgentActivityContext.Provider>
    </BpiProgressContext.Provider>
  );
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 12);
}
