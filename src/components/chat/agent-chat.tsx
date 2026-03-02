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
import { LeadSensThread } from "./thread";
import { GreetingLoader } from "./greeting-loader";
import { GreetingScreen } from "./greeting-screen";
import { ThemeToggle } from "./theme-toggle";
import { useConversations } from "@/components/conversation-provider";
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

// ─── Client-side tool labels (French) ────────────────────

const STEP_LABELS: Record<string, string> = {
  parse_icp: "Parsing target profile (ICP)",
  instantly_count_leads: "Estimating available leads",
  instantly_source_leads: "Sourcing leads via SuperSearch",
  instantly_preview_leads: "Previewing leads found",
  score_leads_batch: "Validating leads",
  enrich_leads_batch: "Enriching lead profiles",
  draft_emails_batch: "Writing personalized emails",
  draft_single_email: "Writing an email",
  generate_campaign_angle: "Generating campaign angle",
  instantly_create_campaign: "Creating draft in Instantly",
  instantly_add_leads_to_campaign: "Adding leads to campaign",
  instantly_activate_campaign: "Activating campaign",
  crm_check_duplicates: "Checking CRM duplicates",
  analyze_company_site: "Analyzing website",
  update_company_dna: "Updating company profile",
  save_memory: "Saving to memory",
  get_memories: "Checking memory",
  delete_memory: "Deleting from memory",
  render_lead_table: "Preparing lead table",
  render_email_preview: "Preparing email preview",
  render_campaign_summary: "Preparing summary",
  instantly_list_accounts: "Fetching email accounts",
};

function getStepLabel(toolName: string): string {
  return STEP_LABELS[toolName] ?? toolName.replace(/_/g, " ");
}

// ─── Constants ────────────────────────────────────────────

const MAX_RETRIES = 3;
const DEFAULT_RETRY_MS = 3000;

// ─── Main Component ──────────────────────────────────────

export default function AgentChat() {
  const {
    activeId,
    chatKey,
    registerNewConversation,
    refreshConversations,
  } = useConversations();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activityLabel, setActivityLabel] = useState<string | null>(null);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [hasUserSentMessage, setHasUserSentMessage] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Mutable refs for the current session
  const conversationIdRef = useRef(generateId());
  const abortRef = useRef<AbortController | null>(null);
  const pendingContentRef = useRef("");
  const updateScheduledRef = useRef(false);
  const isNewConversationRef = useRef(true);
  const retryCountRef = useRef(0);
  const retryIntervalRef = useRef(DEFAULT_RETRY_MS);

  // Track chatKey to detect conversation switches
  const prevChatKeyRef = useRef(chatKey);
  const initializedRef = useRef(false);

  // ─── Conversation switch / init ────────────────────────

  useEffect(() => {
    const isInit = !initializedRef.current;
    const isSwitching = prevChatKeyRef.current !== chatKey;
    prevChatKeyRef.current = chatKey;

    if (!isInit && !isSwitching) return;
    initializedRef.current = true;

    // Abort any in-flight stream
    abortRef.current?.abort();

    // Reset all state
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
      // ── Load existing conversation from DB ──
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
      // ── New chat: generate fresh ID, send greeting ──
      const newId = generateId();
      conversationIdRef.current = newId;
      isNewConversationRef.current = true;
      setIsLoadingHistory(false);

      // Send greeting
      sendGreeting(newId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatKey, activeId]);

  // ─── Greeting helper ──────────────────────────────────

  const sendGreeting = useCallback(
    async (convId: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      pendingContentRef.current = "";

      const assistantId = generateId();

      const attemptStream = async (): Promise<void> => {
        const res = await fetch("/api/agents/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: convId,
            messages: [],
            isGreeting: true,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Greeting failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        setMessages([{ id: assistantId, role: "assistant", content: "" }]);

        const parser = createParser({
          onEvent(event) {
            const eventName = event.event as SSEEventName | undefined;
            if (!eventName) return;
            const eventData = JSON.parse(event.data);

            if (eventName === "text-delta") {
              const payload = eventData as SSEEventPayload["text-delta"];
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
            }
          },
          onRetry() {},
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
        if ((err as Error).name !== "AbortError") {
          // Fallback greeting
          setMessages([
            {
              id: assistantId,
              role: "assistant",
              content:
                "Hey, welcome to LeadSens! 👋\n\nI'm your prospecting copilot. Describe your target, and I'll handle the rest: sourcing, enrichment, email drafting, and pushing everything into Instantly.\n\nTo get started, I need two things:\n\n1. **Your website URL** so I can analyze your offer and personalize every email\n2. **Your Instantly account** - connect it in *Settings > Integrations* with your API V2 key\n\nStart by giving me your website URL, and we'll go step by step.",
            },
          ]);
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [],
  );

  // ─── Stream to server (user messages) ─────────────────

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

      const toolCallNames = new Map<string, string>();

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

              case "tool-input-start": {
                const payload = data as SSEEventPayload["tool-input-start"];
                const stepLabel = getStepLabel(payload.toolName);
                if (payload.toolCallId) {
                  toolCallNames.set(payload.toolCallId, payload.toolName);
                }
                setThinkingSteps((prev) => [
                  ...prev.map((s) =>
                    s.status === "running"
                      ? { ...s, status: "done" as const }
                      : s,
                  ),
                  {
                    id: payload.toolCallId || generateId(),
                    label: stepLabel,
                    status: "running" as const,
                  },
                ]);
                setActivityLabel(stepLabel);
                break;
              }

              case "tool-output-available": {
                const payload =
                  data as SSEEventPayload["tool-output-available"];
                setThinkingSteps((prev) =>
                  prev.map((s) =>
                    s.id === payload.toolCallId
                      ? { ...s, status: "done" as const }
                      : s,
                  ),
                );
                const completedTool = toolCallNames.get(payload.toolCallId);
                if (
                  completedTool === "analyze_company_site" ||
                  completedTool === "update_company_dna"
                ) {
                  window.dispatchEvent(
                    new CustomEvent("leadsens:company-dna-updated"),
                  );
                }

                // Inject inline component markers into the message content
                const toolOutput = payload.output as Record<
                  string,
                  unknown
                > | null;
                let hasNewComponents = false;
                if (
                  toolOutput &&
                  typeof toolOutput === "object"
                ) {
                  // Single component
                  if ("__component" in toolOutput) {
                    const marker = JSON.stringify({
                      component: toolOutput.__component,
                      props: toolOutput.props,
                    });
                    pendingContentRef.current += `\n\n@@INLINE@@${marker}@@END@@\n\n`;
                    hasNewComponents = true;
                  }
                  // Multiple components (e.g. email previews from draft_emails_batch)
                  if ("__components" in toolOutput && Array.isArray(toolOutput.__components)) {
                    for (const comp of toolOutput.__components as Array<{ component: string; props: Record<string, unknown> }>) {
                      if (comp?.component && comp?.props) {
                        const marker = JSON.stringify({
                          component: comp.component,
                          props: comp.props,
                        });
                        pendingContentRef.current += `\n\n@@INLINE@@${marker}@@END@@\n\n`;
                        hasNewComponents = true;
                      }
                    }
                  }
                }
                if (hasNewComponents && !updateScheduledRef.current) {
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
                setThinkingSteps((prev) => {
                  const hasRunning = prev.some((s) => s.status === "running");
                  if (!hasRunning) return prev;
                  return prev.map((s) =>
                    s.status === "running"
                      ? { ...s, label: payload.label }
                      : s,
                  );
                });
                break;
              }

              case "finish":
                setThinkingSteps((prev) =>
                  prev.map((s) =>
                    s.status === "running"
                      ? { ...s, status: "done" as const }
                      : s,
                  ),
                );
                setActivityLabel(null);
                break;

              case "error": {
                const payload = data as SSEEventPayload["error"];
                console.error("Stream error:", payload.message);
                setThinkingSteps((prev) =>
                  prev.map((s) =>
                    s.status === "running"
                      ? { ...s, status: "error" as const }
                      : s,
                  ),
                );
                setActivityLabel(null);
                break;
              }

              case "stream-start":
              case "stream-end":
              case "step-complete":
              case "tool-input-available":
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
          console.warn(
            `[SSE] Retry ${retryCountRef.current}/${MAX_RETRIES} in ${delay}ms`,
          );
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

        // Refresh sidebar after stream completes
        if (isNewConversationRef.current) {
          isNewConversationRef.current = false;
          registerNewConversation(convId);
        } else {
          refreshConversations();
        }
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
          <header className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-lg overflow-hidden">
                <img src="/L.svg" alt="LeadSens" className="size-7" />
              </div>
              <h1 className="text-sm font-semibold">LeadSens</h1>
            </div>
            <ThemeToggle />
          </header>

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
              <GreetingScreen
                greetingContent={messages[0]?.content ?? ""}
                isStreaming={isStreaming}
              />
            ) : (
              <LeadSensThread isStreaming={isStreaming} />
            )}
          </AgentRuntimeProvider>
        </div>

        {/* Screen reader streaming announcements */}
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
