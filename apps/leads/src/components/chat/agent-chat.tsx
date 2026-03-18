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
import { LeadSensThread } from "./thread";
import { GreetingLoader } from "./greeting-loader";
import { GreetingScreen } from "./greeting-screen";
import { PipelineStatusBar } from "./pipeline-status-bar";
import { CampaignPipelineBar } from "./campaign-pipeline-bar";
import { ThemeToggle } from "./theme-toggle";
import { AutonomySelector } from "./autonomy-selector";
import { MessageActionsProvider, type MessageActions, AgentActivityContext, type ThinkingStep, useSidebar, Button } from "@leadsens/ui";
import { useConversations } from "@/components/conversation-provider";
import { SidebarSimple } from "@phosphor-icons/react";
import type { SSEEventName, SSEEventPayload } from "@/lib/sse";

// ─── Types ───────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ─── Tool label fallback (server sends labels via SSE status events) ──

function formatToolName(toolName: string): string {
  return toolName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + "...";
}

// ─── Tool output summary extraction ──────────────────────

function extractToolSummary(
  toolName: string,
  output: Record<string, unknown>,
): string | null {
  try {
    switch (toolName) {
      case "parse_icp": {
        const filters = output.filters as Record<string, unknown> | undefined;
        if (!filters) return null;
        const parts: string[] = [];
        if (filters.role) parts.push(String(filters.role));
        if (filters.industry) parts.push(String(filters.industry));
        if (filters.geo || filters.location)
          parts.push(String(filters.geo ?? filters.location));
        return parts.length > 0 ? `Parsed: ${parts.join(", ")}` : null;
      }
      case "count_leads": {
        const count = output.count ?? output.totalResults;
        return count != null ? `~${count} leads available` : null;
      }
      case "source_leads": {
        const leads = output.leads as unknown[] | undefined;
        const count = leads?.length ?? output.count ?? output.totalResults;
        return count != null ? `Found ${count} leads` : null;
      }
      case "score_leads_batch": {
        const results = output.results as unknown[] | undefined;
        const total = results?.length ?? output.total;
        const passed = output.passed ?? output.passedCount;
        if (total != null && passed != null)
          return `${passed}/${total} passed ICP filter`;
        if (total != null) return `Scored ${total} leads`;
        return null;
      }
      case "enrich_leads_batch": {
        const results = output.results as unknown[] | undefined;
        const count =
          results?.length ?? output.enriched ?? output.count ?? output.total;
        return count != null ? `Enriched ${count} leads` : null;
      }
      case "draft_emails_batch": {
        const count = output.drafted ?? output.count ?? output.total;
        const steps = output.steps ?? output.stepCount;
        const patterns = output.winningPatternsUsed ?? output.patternsApplied;
        const styleSamples = output.styleCorrectionsApplied ?? output.styleSamplesUsed;
        const parts: string[] = [];
        if (count != null && steps != null) parts.push(`Drafted ${count} emails across ${steps} steps`);
        else if (count != null) parts.push(`Drafted ${count} emails`);
        if (patterns) parts.push(`using ${patterns} winning patterns`);
        if (styleSamples) parts.push(`with ${styleSamples} style corrections`);
        return parts.length > 0 ? parts.join(", ") : null;
      }
      case "create_campaign": {
        const name = output.name ?? output.campaignName;
        return name ? `Campaign "${name}" created` : "Campaign created";
      }
      case "add_leads_to_campaign": {
        const count =
          output.count ?? output.added ?? output.leadsAdded ?? output.total;
        return count != null ? `${count} leads added` : null;
      }
      case "activate_campaign":
        return "Campaign activated";
      case "analyze_company_site": {
        const domain = output.domain ?? output.url;
        return domain ? `Analyzed ${domain}` : "Site analyzed";
      }
      case "campaign_analytics": {
        const sent = output.sent ?? output.totalSent;
        const replied = output.replied ?? output.positiveReplies;
        if (sent != null && replied != null) {
          const rate =
            Number(sent) > 0
              ? ((Number(replied) / Number(sent)) * 100).toFixed(1)
              : "0";
          return `${sent} sent, ${replied} replied (${rate}%)`;
        }
        return null;
      }
      case "classify_reply": {
        const classification =
          output.classification ?? output.category ?? output.result;
        return classification ? `Classified as ${classification}` : null;
      }
      case "verify_emails": {
        const valid = output.valid ?? output.validCount;
        const total = output.total ?? output.totalCount;
        return valid != null && total != null
          ? `${valid}/${total} valid`
          : null;
      }
      case "campaign_insights": {
        const insights = output.insights as unknown[] | undefined;
        const count = insights?.length ?? output.insightCount;
        return count != null && Number(count) > 0
          ? `${count} insight${Number(count) !== 1 ? "s" : ""} from campaign data`
          : "No insights yet (need more data)";
      }
      case "campaign_performance_report": {
        const overview = output.overview as Record<string, unknown> | undefined;
        if (overview) {
          const sent = overview.sent;
          const replied = overview.replied;
          if (sent != null && replied != null) {
            const rate = Number(sent) > 0 ? ((Number(replied) / Number(sent)) * 100).toFixed(1) : "0";
            return `Report: ${sent} sent, ${replied} replied (${rate}%)`;
          }
        }
        return "Performance report generated";
      }
      case "sync_campaign_analytics":
        return "Analytics synced from ESP";
      case "learning_summary": {
        const learnings = output.learnings as unknown[] | undefined;
        const hasData = output.hasData as boolean | undefined;
        if (!hasData) return "No patterns yet";
        return learnings?.length
          ? `${learnings.length} learning${learnings.length !== 1 ? "s" : ""} from past campaigns`
          : null;
      }
      case "update_company_dna":
        return "Company DNA updated";
      case "send_test_email": {
        const email = output.test_email as string | undefined;
        return email ? `Test sent to ${email}` : "Test email sent";
      }
      case "list_campaigns": {
        const campaigns = output.campaigns as unknown[] | undefined;
        return campaigns
          ? `${campaigns.length} campaign${campaigns.length !== 1 ? "s" : ""} found`
          : null;
      }
      case "demo_search_leads": {
        const count = output.count as number | undefined;
        return count != null ? `${count} sample leads found` : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// ─── Constants ────────────────────────────────────────────

const MAX_RETRIES = 3;
const DEFAULT_RETRY_MS = 3000;

// Singleton dedup is handled server-side (route.ts) — no client-side dedup needed

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
  const [integrations, setIntegrations] = useState<{ type: string; status: string; accountEmail?: string | null }[]>([]);
  const [companyDna, setCompanyDna] = useState<{
    oneLiner: string | null;
    targetBuyers: Array<{ role?: string; sellingAngle?: string }>;
    differentiators: string[];
    problemsSolved: string[];
  } | null>(null);
  const [pipelinePhase, setPipelinePhase] = useState<string | null>(null);
  const [resumptionSummary, setResumptionSummary] = useState<string | null>(null);
  const [lastCampaign, setLastCampaign] = useState<{
    name: string;
    status: string;
    sent: number;
    replied: number;
    replyRate: string;
  } | null>(null);

  // Mutable refs for the current session
  const thinkingStepsRef = useRef<ThinkingStep[]>([]);
  const conversationIdRef = useRef(generateId());
  const abortRef = useRef<AbortController | null>(null);
  const pendingContentRef = useRef("");
  const updateScheduledRef = useRef(false);
  const isNewConversationRef = useRef(true);
  const retryCountRef = useRef(0);
  const retryIntervalRef = useRef(DEFAULT_RETRY_MS);

  // Fetch integrations + Company DNA once on mount — data is ready before GreetingScreen renders
  useEffect(() => {
    fetch("/api/trpc/integration.list")
      .then((r) => r.json())
      .then((data) => { if (data?.result?.data) setIntegrations(data.result.data); })
      .catch(() => {});

    fetch("/api/trpc/workspace.getCompanyDnaSummary")
      .then((r) => r.json())
      .then((data) => {
        const dna = data?.result?.data;
        if (dna) setCompanyDna(dna);
      })
      .catch(() => {});

    fetch("/api/trpc/campaign.listWithAnalytics")
      .then((r) => r.json())
      .then((data) => {
        const campaigns = data?.result?.data ?? [];
        if (campaigns.length === 0) return;
        // Pick most recent campaign with analytics
        const withStats = campaigns.find(
          (c: { analyticsCache?: { sent?: number } | null }) =>
            c.analyticsCache && (c.analyticsCache.sent ?? 0) > 0,
        );
        if (!withStats) return;
        const sent = withStats.analyticsCache?.sent ?? 0;
        const replied = withStats.analyticsCache?.replied ?? 0;
        const rate = sent > 0 ? ((replied / sent) * 100).toFixed(1) : "0";
        setLastCampaign({
          name: withStats.name,
          status: withStats.status,
          sent,
          replied,
          replyRate: rate,
        });
      })
      .catch(() => {});
  }, []);

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
    setResumptionSummary(null);
    setPipelinePhase(null);

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

          // Fetch resumption summary for returning users
          try {
            const summaryRes = await fetch(
              `/api/trpc/conversation.getResumptionSummary?input=${encodeURIComponent(
                JSON.stringify({ conversationId: activeId }),
              )}`,
            );
            const summaryData = await summaryRes.json();
            const summary = summaryData?.result?.data?.summary;
            if (summary) setResumptionSummary(summary);
          } catch {
            // Non-critical — ignore
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
        // Fallback greeting
        setMessages([
          {
            id: assistantId,
            role: "assistant",
            content:
              "Hey, welcome to LeadSens! 👋\n\nI'm your prospecting copilot. Describe your target, and I'll handle the rest: sourcing, enrichment, email drafting, and pushing everything into Instantly.\n\nTo get started, I need two things:\n\n1. **Your website URL** so I can analyze your offer and personalize every email\n2. **Your Instantly account** - connect it in *Settings > Integrations* with your API V2 key\n\nStart by giving me your website URL, and we'll go step by step.",
          },
        ]);
      } finally {
        setIsStreaming(false);
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
                // Server sends a status event with the label right before tool-input-start.
                // Use the current activityLabel (set by the status event) as the step label,
                // with a formatted fallback if the server label hasn't arrived yet.
                const stepLabel = activityLabel ?? formatToolName(payload.toolName);
                if (payload.toolCallId) {
                  toolCallNames.set(payload.toolCallId, payload.toolName);
                }
                const now = Date.now();
                setThinkingSteps((prev) => [
                  ...prev.map((s) =>
                    s.status === "running"
                      ? { ...s, status: "done" as const, completedAt: s.completedAt ?? now }
                      : s,
                  ),
                  {
                    id: payload.toolCallId || generateId(),
                    label: stepLabel,
                    status: "running" as const,
                    startedAt: now,
                    toolName: payload.toolName,
                  },
                ]);
                setActivityLabel(stepLabel);
                break;
              }

              case "tool-output-available": {
                const payload =
                  data as SSEEventPayload["tool-output-available"];
                const completedAt = Date.now();
                const completedToolName = toolCallNames.get(payload.toolCallId);
                const toolOutput = payload.output as Record<string, unknown> | null;
                // Detect tool-level errors (tools return { error: "..." })
                const isToolError = toolOutput && typeof toolOutput === "object" && "error" in toolOutput && typeof toolOutput.error === "string";
                const summary = isToolError
                  ? String(toolOutput.error)
                  : (completedToolName && toolOutput && typeof toolOutput === "object"
                    ? extractToolSummary(completedToolName, toolOutput)
                    : null);
                const stepStatus = isToolError ? "error" as const : "done" as const;
                setThinkingSteps((prev) =>
                  prev.map((s) =>
                    s.id === payload.toolCallId
                      ? {
                          ...s,
                          status: stepStatus,
                          completedAt,
                          ...(summary ? { summary } : {}),
                        }
                      : s,
                  ),
                );
                if (
                  completedToolName === "analyze_company_site" ||
                  completedToolName === "update_company_dna"
                ) {
                  window.dispatchEvent(
                    new CustomEvent("leadsens:company-dna-updated"),
                  );
                }

                // Inject inline component markers into the message content
                let hasNewComponents = false;
                if (
                  toolOutput &&
                  typeof toolOutput === "object"
                ) {
                  // Single component
                  if ("__component" in toolOutput) {
                    const marker = JSON.stringify({
                      component: toolOutput.__component as string,
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
                // Conversation is already saved in DB at this point,
                // so refresh sidebar immediately for new conversations
                if (isNewConversationRef.current) {
                  isNewConversationRef.current = false;
                  registerNewConversation(convId);
                }
                break;
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

        // Embed completed thinking steps into the assistant message
        const finalSteps = thinkingStepsRef.current;
        if (finalSteps.length > 0) {
          const stepsForMarker = finalSteps.map((s) => ({
            label: s.label,
            status: s.status,
            summary: s.summary,
            startedAt: s.startedAt,
            completedAt: s.completedAt,
          }));
          const marker = `\n\n@@THINKING@@${JSON.stringify(stepsForMarker)}@@END_THINKING@@`;
          pendingContentRef.current += marker;
          const finalContent = pendingContentRef.current;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: finalContent } : m,
            ),
          );
        }

        // Refresh sidebar after stream completes (updates timestamp/order)
        refreshConversations();

        // Notify status bar to refresh
        window.dispatchEvent(new CustomEvent("leadsens:stream-complete"));
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

  // ─── Message actions (edit, regenerate, feedback) ──────

  const handleEdit = useCallback(
    (messageId: string, newContent: string) => {
      if (isStreaming) return;
      const msgIndex = messages.findIndex((m) => m.id === messageId);
      if (msgIndex === -1) return;

      // Truncate to the edited message, update its content, resend
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

      // Find the preceding user message and truncate to include it
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
      }).catch(() => {
        // Non-critical — ignore
      });
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

  // ─── Keep thinkingSteps ref in sync with state ──────
  useEffect(() => {
    thinkingStepsRef.current = thinkingSteps;
  }, [thinkingSteps]);

  // ─── Refresh Company DNA when agent updates it ────────
  useEffect(() => {
    const handler = () => {
      fetch("/api/trpc/workspace.getCompanyDnaSummary")
        .then((r) => r.json())
        .then((data) => {
          const dna = data?.result?.data;
          if (dna) setCompanyDna(dna);
        })
        .catch(() => {});
    };
    window.addEventListener("leadsens:company-dna-updated", handler);
    return () => window.removeEventListener("leadsens:company-dna-updated", handler);
  }, []);

  // ─── Account picker event listener ────────────────────

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ accounts: string[] }>).detail;
      if (detail?.accounts?.length) {
        const accountList = detail.accounts.join(", ");
        handleSend(`Use these sending accounts: ${accountList}`);
      }
    };
    window.addEventListener("leadsens:accounts-selected", handler);
    return () => window.removeEventListener("leadsens:accounts-selected", handler);
  }, [handleSend]);

  // ─── Campaign launch preview event listener ────────────

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ action: string; message: string }>).detail;
      if (detail?.message) {
        handleSend(detail.message);
      }
    };
    window.addEventListener("leadsens:campaign-launch", handler);
    return () => window.removeEventListener("leadsens:campaign-launch", handler);
  }, [handleSend]);

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
            <div className="flex items-center gap-1">
              <AutonomySelector />
              <ThemeToggle />
            </div>
          </header>

          {/* Pipeline status bar — shows when campaigns exist */}
          <PipelineStatusBar />

          {/* Campaign pipeline progress — shows during active pipeline */}
          <CampaignPipelineBar />

          <MessageActionsProvider value={messageActions}>
            <AgentRuntimeProvider
              messages={messages}
              isStreaming={isStreaming}
              onSend={handleSend}
              onCancel={handleCancel}
            >
              {/* Resumption summary banner */}
              {resumptionSummary && !isStreaming && (
                <div className="px-4 pt-2">
                  <div className="max-w-[720px] mx-auto">
                    <p className="text-xs text-muted-foreground italic bg-muted/30 rounded-lg px-3 py-2 border border-border/30">
                      {resumptionSummary}
                    </p>
                  </div>
                </div>
              )}

              {isLoadingHistory ? (
                <GreetingLoader />
              ) : isLoadingGreeting ? (
                <GreetingLoader />
              ) : showGreetingScreen ? (
                <GreetingScreen
                  isStreaming={isStreaming}
                  integrations={integrations}
                  companyDna={companyDna}
                  lastCampaign={lastCampaign}
                />
              ) : (
                <LeadSensThread isStreaming={isStreaming} pipelinePhase={pipelinePhase} />
              )}
            </AgentRuntimeProvider>
          </MessageActionsProvider>
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
