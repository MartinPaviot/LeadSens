"use client";

import {
  useCallback,
  useRef,
  useState,
  useEffect,
  createContext,
  useContext,
  useMemo,
} from "react";
import { createParser } from "eventsource-parser";
import { AgentRuntimeProvider } from "./agent-runtime-provider";
import { ElevayThread } from "./thread";
import { GreetingLoader } from "./greeting-loader";
import { GreetingScreen } from "./greeting-screen";
import { ThemeToggle } from "./theme-toggle";
import { MessageActionsProvider, type MessageActions } from "./message-actions-context";
import { useConversations } from "@/components/conversation-provider";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { SidebarSimple } from "@phosphor-icons/react";
import type { SSEEventName, SSEEventPayload } from "@/lib/sse";

// ─── Types ───────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface ThinkingStep {
  id: string;
  label: string;
  status: "running" | "done" | "error";
}

interface AgentActivityContextValue {
  label: string | null;
  steps: ThinkingStep[];
  isThinking: boolean;
  isStreaming: boolean;
  setLabel: (label: string | null) => void;
}

export const AgentActivityContext = createContext<AgentActivityContextValue>({
  label: null,
  steps: [],
  isThinking: false,
  isStreaming: false,
  setLabel: () => {},
});

export function useAgentActivity() {
  return useContext(AgentActivityContext);
}

// ─── Constants ────────────────────────────────────────────

const MAX_RETRIES = 3;
const DEFAULT_RETRY_MS = 3000;

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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activityLabel, setActivityLabel] = useState<string | null>(null);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [hasUserSentMessage, setHasUserSentMessage] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const conversationIdRef = useRef(generateId());
  const abortRef = useRef<AbortController | null>(null);
  const pendingContentRef = useRef("");
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

  // ─── Send handler ─────────────────────────────────────

  const handleSend = useCallback(
    (content: string) => {
      if (!content.trim() || content.length > 500_000) return;
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
    [messages, sendToServer],
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
      isStreaming,
      setLabel: setActivityLabel,
    }),
    [activityLabel, thinkingSteps, isStreaming],
  );

  // ─── Render ───────────────────────────────────────────

  return (
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
                <GreetingScreen isStreaming={isStreaming} />
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
    </AgentActivityContext.Provider>
  );
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 12);
}
