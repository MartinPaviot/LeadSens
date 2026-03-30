"use client";

import {
  useCallback,
  useRef,
  useState,
  useEffect,
  useMemo,
} from "react";
import { createParser } from "eventsource-parser";
import { toast } from "sonner";
import { AgentRuntimeProvider } from "./agent-runtime-provider";
import { ElevayThread } from "./thread";
import { GreetingLoader } from "./greeting-loader";
import { GreetingScreen } from "./greeting-screen";
import { ThemeToggle } from "./theme-toggle";
import { MessageActionsProvider, type MessageActions, AgentActivityContext, type AgentActivityContextValue, type ThinkingStep, useSidebar, Button } from "@leadsens/ui";
import { useConversations } from "@/components/conversation-provider";
import { SidebarSimple, Gear } from "@phosphor-icons/react";
import type { SSEEventName, SSEEventPayload } from "@/lib/sse";
import { trpc } from "@/lib/trpc-client";
import { OnboardingModal } from "./onboarding-modal";
import { SettingsModal } from "./settings-modal";
import { BpiProgressContext, type ModuleItem, type ExportButton } from "./bpi-progress-context";
import type { BpiOutput } from "@/agents/bpi-01/types";
import type { MtsOutput } from "@/agents/mts-02/types";
import type { CiaOutput } from "@/agents/cia-03/types";
import type { ChatSuggestion } from "./suggestion-bubble";

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

// ─── Summary builders ────────────────────────────────────

function buildBpiSummary(bpiOutput: BpiOutput, brandName: string): string {
  const { scores, top_risks, quick_wins, benchmark_data } = bpiOutput;
  const scoreBreakdown = `Réputation ${scores.reputation} · Visibilité ${scores.visibility} · Social ${scores.social} · Compétitif ${scores.competitive}`;
  const risk = top_risks[0] ? `⚠️ ${top_risks[0].description} [${top_risks[0].urgency}]` : null;
  const win = quick_wins[0] ? `✅ ${quick_wins[0].action} (${quick_wins[0].estimated_time})` : null;
  const topComp = benchmark_data?.radar.length
    ? benchmark_data.radar.reduce((a, b) => a.serp_share + a.seo_score > b.serp_share + b.seo_score ? a : b)
    : null;
  const compLine = topComp ? `🏆 Concurrent dominant : **${topComp.name}** (SERP ${topComp.serp_share} · SEO ${topComp.seo_score})` : null;
  return [
    `🔍 **Audit de présence — ${brandName}** — Score global **${scores.global}/100**`,
    scoreBreakdown,
    risk,
    win,
    compLine,
  ].filter(Boolean).join("\n");
}

function buildMtsSummary(output: MtsOutput): string {
  const { session_context, trending_topics, saturated_topics, differentiating_angles } = output;
  const top3 = [...trending_topics]
    .sort((a, b) => b.opportunity_score - a.opportunity_score)
    .slice(0, 3)
    .map((t) => `**${t.topic}** (${t.opportunity_score}/100)`)
    .join(" · ");
  const angle = differentiating_angles[0] ?? null;
  const sat = saturated_topics[0]?.topic ?? null;
  return [
    `📈 **Analyse de marché — ${session_context.sector}**`,
    top3 ? `Top tendances : ${top3}` : null,
    angle ? `Angle différenciant : ${angle}` : null,
    sat ? `À éviter : ~~${sat}~~` : null,
  ].filter(Boolean).join("\n");
}

function buildCiaSummary(output: CiaOutput, brandName: string): string {
  const { competitor_scores, strategic_zones, opportunities } = output;
  const client = competitor_scores.find((c) => c.is_client);
  const others = [...competitor_scores.filter((c) => !c.is_client)].sort((a, b) => b.global_score - a.global_score);
  const scoresLine = [client, ...others].filter(Boolean)
    .map((c) => c!.is_client ? `**vous : ${c!.global_score}/100** (${c!.level})` : `${c!.entity} : ${c!.global_score}/100`)
    .join(" · ");
  const redAxes = strategic_zones.filter((z) => z.zone === "red").map((z) => z.axis).join(", ") || null;
  const greenAxes = strategic_zones.filter((z) => z.zone === "green").map((z) => z.axis).join(", ") || null;
  const zonesLine = [redAxes ? `❌ ${redAxes}` : null, greenAxes ? `✅ ${greenAxes}` : null].filter(Boolean).join(" · ") || null;
  const opp = opportunities[0] ? `${opportunities[0].description} (${opportunities[0].timeframe})` : null;
  return [
    `🎯 **Analyse concurrentielle — ${brandName}**`,
    scoresLine,
    zonesLine ? `Zones : ${zonesLine}` : null,
    opp ? `Opportunité : ${opp}` : null,
  ].filter(Boolean).join("\n");
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
  const [showSettings, setShowSettings] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activityLabel, setActivityLabel] = useState<string | null>(null);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [hasUserSentMessage, setHasUserSentMessage] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [bpiModules, setBpiModules] = useState<ModuleItem[] | null>(null);
  const [bpiExpanded, setBpiExpanded] = useState(false);
  const [bpiExportButton, setBpiExportButton] = useState<Omit<ExportButton, "assistantId"> | null>(null);
  const [lastSuggestion, setLastSuggestion] = useState<ChatSuggestion | null>(null);
  const lastSuggestionRef = useRef<ChatSuggestion | null>(null);
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
  const brandSectorRef = useRef<string>("");
  const brandChannelsRef = useRef<string[]>([]);
  const brandObjectiveRef = useRef<string>("branding");
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
    brandSectorRef.current = brandProfile?.sector ?? brandProfile?.primary_keyword ?? "";
    brandChannelsRef.current =
      brandProfile?.priority_channels && brandProfile.priority_channels.length > 0
        ? brandProfile.priority_channels
        : ["SEO"];
    brandObjectiveRef.current = brandProfile?.objective ?? "branding";
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
    setLastSuggestion(null);

    const assistantId = generateId();
    setMessages((prev) => [
      ...prev,
      { id: generateId(), role: "user", content: "🔍 Audit my brand" },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    // Initialize module progress UI
    const MODULE_LABELS = ["SERP", "Presse", "YouTube", "Social", "SEO", "Benchmark", "Google Maps", "Trustpilot"];
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
      const bpiSuggestion: ChatSuggestion = {
        content: "Your brand audit is complete. Want to go deeper?",
        actions: [
          { label: "📈 Analyze market trends", handler: "trends" },
          { label: "🎯 Analyze my competitors", handler: "competitors" },
        ],
      };
      lastSuggestionRef.current = bpiSuggestion;
      setLastSuggestion(bpiSuggestion);
      console.log("[suggestion] lastSuggestion set:", bpiSuggestion);
      setTimeout(() => {
        const scrollable = document.querySelector("[data-thread-viewport]")
          ?? document.querySelector("[class*=\"overflow-y-auto\"]");
        if (scrollable) {
          scrollable.scrollTop = scrollable.scrollHeight;
        } else {
          window.scrollTo(0, document.body.scrollHeight);
        }
      }, 200);

      // Build short summary (or fallback) and update the single assistant bubble
      const summary = capturedBpiOutput
        ? buildBpiSummary(capturedBpiOutput, capturedBrandName)
        : "⚠️ The audit completed but data could not be retrieved.";

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
          const result = await res.json() as { type: string; url?: string; message?: string };
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
          toast.error(result.message ?? "Google Docs export failed. The report is available as PDF.");
        } catch (err) {
          console.error("[gdoc-export] BPI:", err);
          toast.error("Google Docs export failed. The report is available as PDF.");
        }
      }

      // PDF (default) or gdoc fallback: show inline export button
      setBpiExportButton({
        label: "📥 Download report (PDF)",
        onClick: async () => {
          setBpiExportButton(null);
          try {
            const res = await fetch("/api/agents/bmi/export", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ format: "pdf" }),
            });
            if (res.ok && res.headers.get("content-type")?.includes("application/pdf")) {
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const disposition = res.headers.get("content-disposition") ?? "";
              const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "bpi-01.pdf";
              const a = document.createElement("a");
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: summary + "\n\n📥 Downloading PDF..." }
                    : m,
                ),
              );
            } else {
              let errMsg = "Export unavailable.";
              const ct = res.headers.get("content-type") ?? "";
              if (ct.includes("application/json")) {
                try {
                  const result = await res.json() as { type?: string; message?: string };
                  errMsg = result.message ?? errMsg;
                } catch { /* ignore parse error */ }
              }
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
                  ? { ...m, content: summary + "\n\n⚠️ Download failed." }
                  : m,
              ),
            );
          }
        },
      });
    }
  }, [isStreaming, registerNewConversation, refreshConversations]);

  // ─── MTS-02 market trends stream ──────────────────────

  const streamMtsAudit = useCallback(async () => {
    if (isStreaming) return;

    if (noBrandProfileRef.current) {
      setShowOnboarding(true);
      return;
    }

    const sector = brandSectorRef.current;
    if (!sector || sector.length < 2) {
      toast.error("Please fill in your brand sector in Settings before running this analysis.");
      return;
    }

    const priority_channels = brandChannelsRef.current;

    setHasUserSentMessage(true);
    setThinkingSteps([]);
    pendingContentRef.current = "";

    const convId = conversationIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    setLastSuggestion(null);

    const assistantId = generateId();
    setMessages((prev) => [
      ...prev,
      { id: generateId(), role: "user", content: "Analyze market trends for my sector" },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    let capturedMtsOutput: MtsOutput | null = null;

    try {
      const res = await fetch("/api/agents/bmi/mts-02", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sector, priority_channels }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`MTS-02 failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parser = createParser({
        onEvent(event) {
          const eventName = event.event as SSEEventName | undefined;
          if (!eventName) return;
          const data = JSON.parse(event.data) as SSEEventPayload[typeof eventName];

          if (eventName === "text-delta") {
            // Ignore markdown delta — summary is built in finally via buildMtsSummary
          } else if (eventName === "result") {
            const payload = data as SSEEventPayload["result"];
            capturedMtsOutput = (payload.mtsOutput ?? payload.bpiOutput) as MtsOutput;
          } else if (eventName === "status") {
            const payload = data as SSEEventPayload["status"];
            setActivityLabel(payload.label);
          } else if (eventName === "error") {
            const payload = data as SSEEventPayload["error"];
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: `⚠️ ${payload.message}` } : m,
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
      if ((err as Error).name !== "AbortError") console.error("MTS-02 stream error:", err);
    } finally {
      setIsStreaming(false);
      setActivityLabel(null);
      abortRef.current = null;
      if (isNewConversationRef.current) {
        isNewConversationRef.current = false;
        registerNewConversation(convId);
      }
      refreshConversations();

      const mtsSummary = capturedMtsOutput
        ? buildMtsSummary(capturedMtsOutput)
        : "Market trends analysis complete.";
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: mtsSummary } : m)),
      );
      bpiAuditMessageIdRef.current = assistantId;

      const mtsSuggestion: ChatSuggestion = {
        content: "Market trends analysis complete. Ready for the next step?",
        actions: [
          { label: "🔍 Audit my brand", handler: "brand" },
          { label: "🎯 Analyze my competitors", handler: "competitors" },
        ],
      };
      lastSuggestionRef.current = mtsSuggestion;
      setLastSuggestion(mtsSuggestion);

      const mtsFmt = exportFormatRef.current;
      if (mtsFmt === "gdoc" && capturedMtsOutput) {
        try {
          const gdocRes = await fetch("/api/agents/bmi/export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ format: "gdoc", agentCode: "MTS-02" }),
          });
          const gdocResult = await gdocRes.json() as { type: string; url?: string; message?: string };
          if (gdocResult.type === "gdoc" && gdocResult.url) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: mtsSummary + `\n\n📄 [Ouvrir dans Google Docs →](${gdocResult.url})` }
                  : m,
              ),
            );
            return;
          }
          toast.error(gdocResult.message ?? "Google Docs export failed. The report is available as PDF.");
        } catch (err) {
          console.error("[gdoc-export] MTS:", err);
          toast.error("Google Docs export failed. The report is available as PDF.");
        }
      }

      if (capturedMtsOutput) {
        const mtsOutput = capturedMtsOutput;
        setBpiExportButton({
          label: "📥 Download report (PDF)",
          onClick: async () => {
            setBpiExportButton(null);
            try {
              const res = await fetch("/api/agents/bmi/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ format: "pdf", agentCode: "MTS-02" }),
              });
              if (res.ok && res.headers.get("content-type")?.includes("application/pdf")) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const disposition = res.headers.get("content-disposition") ?? "";
                const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "mts-02.pdf";
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: buildMtsSummary(mtsOutput) + "\n\n📥 Downloading PDF..." }
                      : m,
                  ),
                );
              } else {
                let errMsg = "Export unavailable.";
                const ct = res.headers.get("content-type") ?? "";
                if (ct.includes("application/json")) {
                  try {
                    const result = await res.json() as { type?: string; message?: string };
                    errMsg = result.message ?? errMsg;
                  } catch { /* ignore */ }
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: buildMtsSummary(mtsOutput) + `\n\n⚠️ ${errMsg}` }
                      : m,
                  ),
                );
              }
            } catch (err) {
              console.error("[MTS PDF export]", err);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: buildMtsSummary(mtsOutput) + "\n\n⚠️ Download failed." }
                    : m,
                ),
              );
            }
          },
        });
      }

      setTimeout(() => {
        const scrollable = document.querySelector("[data-thread-viewport]")
          ?? document.querySelector("[class*=\"overflow-y-auto\"]");
        if (scrollable) {
          scrollable.scrollTop = scrollable.scrollHeight;
        } else {
          window.scrollTo(0, document.body.scrollHeight);
        }
      }, 200);
    }
  }, [isStreaming, registerNewConversation, refreshConversations]);

  // ─── CIA-03 competitive analysis stream ───────────────

  const streamCiaAudit = useCallback(async () => {
    if (isStreaming) return;

    if (noBrandProfileRef.current) {
      setShowOnboarding(true);
      return;
    }

    const priority_channels = brandChannelsRef.current;
    const objective = brandObjectiveRef.current;

    setHasUserSentMessage(true);
    setThinkingSteps([]);
    pendingContentRef.current = "";

    const convId = conversationIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    setLastSuggestion(null);

    const assistantId = generateId();
    setMessages((prev) => [
      ...prev,
      { id: generateId(), role: "user", content: "Run a competitive analysis" },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    let capturedCiaOutput: CiaOutput | null = null;
    let capturedCiaBrandName = "";

    try {
      const res = await fetch("/api/agents/bmi/cia-03", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority_channels, objective }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`CIA-03 failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parser = createParser({
        onEvent(event) {
          const eventName = event.event as SSEEventName | undefined;
          if (!eventName) return;
          const data = JSON.parse(event.data) as SSEEventPayload[typeof eventName];

          if (eventName === "text-delta") {
            // Ignore markdown delta — summary is built in finally via buildCiaSummary
          } else if (eventName === "result") {
            const payload = data as SSEEventPayload["result"];
            capturedCiaOutput = payload.bpiOutput as CiaOutput;
            capturedCiaBrandName = payload.brandName;
          } else if (eventName === "status") {
            const payload = data as SSEEventPayload["status"];
            setActivityLabel(payload.label);
          } else if (eventName === "error") {
            const payload = data as SSEEventPayload["error"];
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: `⚠️ ${payload.message}` } : m,
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
      if ((err as Error).name !== "AbortError") console.error("CIA-03 stream error:", err);
    } finally {
      setIsStreaming(false);
      setActivityLabel(null);
      abortRef.current = null;
      if (isNewConversationRef.current) {
        isNewConversationRef.current = false;
        registerNewConversation(convId);
      }
      refreshConversations();

      const ciaSummary = capturedCiaOutput
        ? buildCiaSummary(capturedCiaOutput, capturedCiaBrandName)
        : "Competitive analysis complete.";
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: ciaSummary } : m)),
      );
      bpiAuditMessageIdRef.current = assistantId;

      const ciaSuggestion: ChatSuggestion = {
        content: "Competitive analysis complete. Want to complete your intelligence picture?",
        actions: [
          { label: "🔍 Audit my brand", handler: "brand" },
          { label: "📈 Analyze market trends", handler: "trends" },
        ],
      };
      lastSuggestionRef.current = ciaSuggestion;
      setLastSuggestion(ciaSuggestion);

      const ciaFmt = exportFormatRef.current;
      if (ciaFmt === "gdoc" && capturedCiaOutput) {
        try {
          const gdocRes = await fetch("/api/agents/bmi/export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ format: "gdoc", agentCode: "CIA-03" }),
          });
          const gdocResult = await gdocRes.json() as { type: string; url?: string; message?: string };
          if (gdocResult.type === "gdoc" && gdocResult.url) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: ciaSummary + `\n\n📄 [Ouvrir dans Google Docs →](${gdocResult.url})` }
                  : m,
              ),
            );
            return;
          }
          toast.error(gdocResult.message ?? "Google Docs export failed. The report is available as PDF.");
        } catch (err) {
          console.error("[gdoc-export] CIA:", err);
          toast.error("Google Docs export failed. The report is available as PDF.");
        }
      }

      if (capturedCiaOutput) {
        const ciaOutput = capturedCiaOutput;
        const ciaBrandName = capturedCiaBrandName;
        setBpiExportButton({
          label: "📥 Download report (PDF)",
          onClick: async () => {
            setBpiExportButton(null);
            try {
              const res = await fetch("/api/agents/bmi/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ format: "pdf", agentCode: "CIA-03" }),
              });
              if (res.ok && res.headers.get("content-type")?.includes("application/pdf")) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const disposition = res.headers.get("content-disposition") ?? "";
                const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "cia-03.pdf";
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: buildCiaSummary(ciaOutput, ciaBrandName) + "\n\n📥 Downloading PDF..." }
                      : m,
                  ),
                );
              } else {
                let errMsg = "Export unavailable.";
                const ct = res.headers.get("content-type") ?? "";
                if (ct.includes("application/json")) {
                  try {
                    const result = await res.json() as { type?: string; message?: string };
                    errMsg = result.message ?? errMsg;
                  } catch { /* ignore */ }
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: buildCiaSummary(ciaOutput, ciaBrandName) + `\n\n⚠️ ${errMsg}` }
                      : m,
                  ),
                );
              }
            } catch (err) {
              console.error("[CIA PDF export]", err);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: buildCiaSummary(ciaOutput, ciaBrandName) + "\n\n⚠️ Download failed." }
                    : m,
                ),
              );
            }
          },
        });
      }

      setTimeout(() => {
        const scrollable = document.querySelector("[data-thread-viewport]")
          ?? document.querySelector("[class*=\"overflow-y-auto\"]");
        if (scrollable) {
          scrollable.scrollTop = scrollable.scrollHeight;
        } else {
          window.scrollTo(0, document.body.scrollHeight);
        }
      }, 200);
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
      if (type === "bpi-audit" || type === "brand") void streamBpiAudit();
      if (type === "trends")      void streamMtsAudit();
      if (type === "competitors") void streamCiaAudit();
    },
    [streamBpiAudit, streamMtsAudit, streamCiaAudit],
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

        if (res.ok && res.headers.get("content-type")?.includes("application/pdf")) {
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const disposition = res.headers.get("content-disposition") ?? "";
          const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "bpi-01.pdf";
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "📥 Downloading PDF..." }
                : m,
            ),
          );
        } else if (res.headers.get("content-type")?.includes("application/json")) {
          const result = await res.json() as { type?: string; url?: string; message?: string };
          if (result.type === "gdoc" && result.url) {
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
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: "⚠️ Erreur lors de l'export." } : m,
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
                <>
                  {console.log("[suggestion] rendering thread, lastSuggestion:", lastSuggestion ?? lastSuggestionRef.current, "isStreaming:", isStreaming)}
                  <ElevayThread
                    isStreaming={isStreaming}
                    lastSuggestion={lastSuggestion ?? lastSuggestionRef.current}
                    onSuggestionAction={handleQuickReply}
                  />
                </>
              )}
            </AgentRuntimeProvider>
          </MessageActionsProvider>
        </div>

        <div className="sr-only" aria-live="polite">
          {isStreaming &&
            (activityLabel || "Agent is generating a response...")}
        </div>
      </div>

      <OnboardingModal open={showOnboarding} onComplete={handleOnboardingComplete} initialData={brandProfile} />
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
    </AgentActivityContext.Provider>
    </BpiProgressContext.Provider>
  );
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 12);
}
