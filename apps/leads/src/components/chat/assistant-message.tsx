"use client";

import { Suspense, useMemo } from "react";
import { MessagePrimitive, useMessage } from "@assistant-ui/react";
import Markdown from "react-markdown";
import { getInlineComponent } from "@/lib/inline-component-registry";
import { MARKDOWN_CLASS, StreamingMarkdownText, ActionBar } from "@leadsens/ui";
import { CompletedThinkingBlock } from "./completed-thinking-block";

// ─── Marker pattern for inline components ─────────────────
const INLINE_PATTERN = /@@INLINE@@([\s\S]*?)@@END@@/g;
const THINKING_PATTERN = /@@THINKING@@([\s\S]*?)@@END_THINKING@@/;

// Components that should only appear once per message (last wins)
const SINGLETON_COMPONENTS = new Set([
  "lead-table",
  "account-picker",
  "campaign-summary",
  "progress-bar",
  "enrichment",
  "rich-lead-table",
  "rich-campaign-card",
]);

// ─── Static markdown (react-markdown for split segments) ───
function StaticMarkdownText({ text }: { text: string }) {
  return (
    <div className={MARKDOWN_CLASS}>
      <Markdown>{text}</Markdown>
    </div>
  );
}

// ─── Inline component renderer ─────────────────────────────
function InlineComponentRenderer({ data }: { data: string }) {
  try {
    const parsed = JSON.parse(data) as {
      component: string;
      props: Record<string, unknown>;
    };
    const Component = getInlineComponent(parsed.component);
    if (!Component) return null;
    return (
      <Suspense
        fallback={
          <div className="h-24 animate-pulse bg-muted/30 rounded-lg my-2" />
        }
      >
        <Component {...parsed.props} />
      </Suspense>
    );
  } catch {
    return null;
  }
}

// ─── Mixed content: text interleaved with inline components ─
function InlineContent({ rawText }: { rawText: string }) {
  const parts = useMemo(() => {
    const result: Array<
      { type: "text"; text: string } | { type: "inline"; data: string }
    > = [];
    let lastIndex = 0;

    INLINE_PATTERN.lastIndex = 0;
    let match;
    while ((match = INLINE_PATTERN.exec(rawText)) !== null) {
      if (match.index > lastIndex) {
        const text = rawText.slice(lastIndex, match.index).trim();
        if (text) result.push({ type: "text", text });
      }
      result.push({ type: "inline", data: match[1] });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < rawText.length) {
      const text = rawText.slice(lastIndex).trim();
      if (text) result.push({ type: "text", text });
    }

    // Deduplicate singleton components (keep last) and move them to the end
    // so they appear AFTER the text, not before
    const lastSingletonIdx = new Map<string, number>();
    for (let i = 0; i < result.length; i++) {
      const part = result[i];
      if (part.type === "inline") {
        try {
          const parsed = JSON.parse(part.data);
          if (SINGLETON_COMPONENTS.has(parsed.component)) {
            lastSingletonIdx.set(parsed.component, i);
          }
        } catch {}
      }
    }

    const nonSingleton: typeof result = [];
    const singletons: typeof result = [];

    for (let i = 0; i < result.length; i++) {
      const part = result[i];
      if (part.type === "inline") {
        try {
          const parsed = JSON.parse(part.data);
          if (SINGLETON_COMPONENTS.has(parsed.component)) {
            // Only keep the last occurrence, skip earlier duplicates
            if (lastSingletonIdx.get(parsed.component) === i) {
              singletons.push(part);
            }
            continue;
          }
        } catch {}
      }
      nonSingleton.push(part);
    }

    // Singletons go at the end (after all text)
    return [...nonSingleton, ...singletons];
  }, [rawText]);

  return (
    <>
      {parts.map((part, i) =>
        part.type === "text" ? (
          <StaticMarkdownText key={i} text={part.text} />
        ) : (
          <InlineComponentRenderer key={i} data={part.data} />
        ),
      )}
    </>
  );
}

// ─── Strip inline + thinking + confirm markers for clipboard ──────────
function getCleanText(raw: string): string {
  return raw
    .replace(/\n*@@INLINE@@[\s\S]*?@@END@@\n*/g, "")
    .replace(/\n*@@THINKING@@[\s\S]*?@@END_THINKING@@\n*/g, "")
    .replace(/\n*@@PENDING_CONFIRM@@[\s\S]*?@@END@@\n*/g, "")
    .trim();
}

// ─── Extract thinking steps from raw text ───────────────────
function extractThinkingSteps(rawText: string): {
  steps: Array<{
    label: string;
    status: "running" | "done" | "error";
    summary?: string;
    startedAt?: number;
    completedAt?: number;
  }> | null;
  cleanedText: string;
} {
  const match = THINKING_PATTERN.exec(rawText);
  if (!match) return { steps: null, cleanedText: rawText };
  try {
    const steps = JSON.parse(match[1]);
    const cleanedText = rawText.replace(THINKING_PATTERN, "").trim();
    return { steps, cleanedText };
  } catch {
    return { steps: null, cleanedText: rawText };
  }
}

// ─── Main component ────────────────────────────────────────
export function AssistantMessage() {
  const message = useMessage();

  // Extract raw text from message content parts
  let rawText = "";
  for (const part of message.content ?? []) {
    if (part.type === "text") {
      rawText += (part as { type: "text"; text: string }).text;
    }
  }

  const { steps: thinkingSteps, cleanedText } = useMemo(
    () => extractThinkingSteps(rawText),
    [rawText],
  );

  // Strip pending confirm markers from display (they're internal state, not user-visible)
  const strippedText = (thinkingSteps ? cleanedText : rawText)
    .replace(/\n*@@PENDING_CONFIRM@@[\s\S]*?@@END@@\n*/g, "");
  const displayText = strippedText;
  const hasText = displayText.trim().length > 0;
  const messageId = message.id ?? "";

  // Hide completely when empty and no thinking steps — ThinkingBlock handles the loading UI
  if (!hasText && !thinkingSteps) return null;

  const hasInlineComponents = displayText.includes("@@INLINE@@");

  return (
    <MessagePrimitive.Root className="group flex items-start w-full motion-safe:animate-[fade-in-up_0.3s_ease-out]">
      <div className="w-12 shrink-0 flex justify-center pt-0.5">
        <div className="size-8 rounded-lg overflow-hidden isolate" style={{ backgroundColor: '#fff' }}>
          <img src="/L.svg" alt="LeadSens" className="size-8 block" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        {thinkingSteps && thinkingSteps.length > 0 && (
          <CompletedThinkingBlock steps={thinkingSteps} />
        )}
        {hasText && (
          <div className="relative rounded-2xl bg-card/90 backdrop-blur-md border border-white/60 dark:border-white/[0.07] shadow-[0_2px_16px_rgba(0,0,0,0.07)] px-4 py-3">
            {hasInlineComponents ? (
              <InlineContent rawText={displayText} />
            ) : thinkingSteps ? (
              /* Static render when thinking steps are present (message already completed) */
              <StaticMarkdownText text={displayText} />
            ) : (
              <MessagePrimitive.Content
                components={{ Text: StreamingMarkdownText }}
              />
            )}
          </div>
        )}
        <ActionBar rawText={rawText} messageId={messageId} cleanText={getCleanText} />
      </div>
    </MessagePrimitive.Root>
  );
}
