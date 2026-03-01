"use client";

import { Suspense, useMemo } from "react";
import { MessagePrimitive, useMessage } from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import Markdown from "react-markdown";
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

    return result;
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
    <MessagePrimitive.Root className="flex gap-3 items-start max-w-[85%] motion-safe:animate-[fade-in-up_0.3s_ease-out]">
      {/* Avatar */}
      <div className="aui-avatar relative shrink-0">
        <div className="size-8 rounded-lg overflow-hidden">
          <img src="/L.svg" alt="LeadSens" className="size-8" />
        </div>
      </div>

      {/* Content bubble */}
      <div className="rounded-[16px_16px_16px_4px] bg-secondary/90 backdrop-blur-sm px-4 py-3 min-w-0">
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
