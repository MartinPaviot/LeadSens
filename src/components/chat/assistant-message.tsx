"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { MessagePrimitive, useMessage } from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import Markdown from "react-markdown";
import { Copy, Check } from "@phosphor-icons/react";
import { getInlineComponent } from "@/lib/inline-component-registry";

const MARKDOWN_CLASS =
  "text-[13.5px] leading-relaxed prose prose-sm dark:prose-invert max-w-none " +
  "[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 " +
  "[&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 " +
  "[&_strong]:font-semibold [&_em]:italic " +
  "[&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-medium " +
  "[&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground";

// ─── Marker pattern for inline components ─────────────────
const INLINE_PATTERN = /@@INLINE@@([\s\S]*?)@@END@@/g;

// Components that should only appear once per message (last wins)
const SINGLETON_COMPONENTS = new Set([
  "lead-table",
  "account-picker",
  "campaign-summary",
  "progress-bar",
  "enrichment",
]);

// ─── Streaming markdown (assistant-ui with smooth typing) ──
function StreamingMarkdownText() {
  return <MarkdownTextPrimitive smooth className={MARKDOWN_CLASS} />;
}

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

// ─── Strip inline markers for clipboard ────────────────────
function getCleanText(raw: string): string {
  return raw.replace(/\n*@@INLINE@@[\s\S]*?@@END@@\n*/g, "").trim();
}

// ─── Copy button ────────────────────────────────────────────
function CopyButton({ rawText }: { rawText: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const clean = getCleanText(rawText);
    if (!clean) return;
    await navigator.clipboard.writeText(clean);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [rawText]);

  return (
    <button
      onClick={handleCopy}
      className="absolute -top-3 right-2 opacity-0 group-hover:opacity-100 transition-opacity size-6 flex items-center justify-center rounded-md bg-muted/80 hover:bg-muted border border-border/50 text-muted-foreground hover:text-foreground"
      aria-label="Copy message"
    >
      {copied ? (
        <Check className="size-3.5" weight="bold" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
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

  const hasText = rawText.trim().length > 0;

  // Hide completely when empty — ThinkingBlock handles the loading UI
  if (!hasText) return null;

  const hasInlineComponents = rawText.includes("@@INLINE@@");

  return (
    <MessagePrimitive.Root className="flex items-start w-full motion-safe:animate-[fade-in-up_0.3s_ease-out]">
      <div className="w-12 shrink-0 flex justify-center pt-0.5">
        <div className="size-8 rounded-lg overflow-hidden isolate" style={{ backgroundColor: '#fff' }}>
          <img src="/L.svg" alt="LeadSens" className="size-8 block" />
        </div>
      </div>
      <div className="group relative flex-1 rounded-2xl bg-card/90 backdrop-blur-md border border-white/60 dark:border-white/[0.07] shadow-[0_2px_16px_rgba(0,0,0,0.07)] px-4 py-3 min-w-0">
        <CopyButton rawText={rawText} />
        {hasInlineComponents ? (
          <InlineContent rawText={rawText} />
        ) : (
          <MessagePrimitive.Content
            components={{ Text: StreamingMarkdownText }}
          />
        )}
      </div>
    </MessagePrimitive.Root>
  );
}
