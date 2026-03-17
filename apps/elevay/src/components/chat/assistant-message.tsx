"use client";

import { useCallback, useState } from "react";
import { MessagePrimitive, useMessage } from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { Copy, Check, ThumbsUp, ThumbsDown, ArrowClockwise } from "@phosphor-icons/react";
import { useMessageActions } from "./message-actions-context";

const MARKDOWN_CLASS =
  "text-[13.5px] leading-relaxed prose prose-sm dark:prose-invert max-w-none " +
  "[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 " +
  "[&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 " +
  "[&_strong]:font-semibold [&_em]:italic " +
  "[&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-medium " +
  "[&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground";

function StreamingMarkdownText() {
  return <MarkdownTextPrimitive smooth className={MARKDOWN_CLASS} />;
}

function ActionBar({ rawText, messageId }: { rawText: string; messageId: string }) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const { onRegenerate, onFeedback } = useMessageActions();

  const handleCopy = useCallback(async () => {
    if (!rawText.trim()) return;
    await navigator.clipboard.writeText(rawText.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [rawText]);

  const handleThumbsUp = useCallback(() => {
    const newState = feedback === "up" ? null : "up";
    setFeedback(newState);
    if (newState && messageId) onFeedback(messageId, "THUMBS_UP");
  }, [feedback, messageId, onFeedback]);

  const handleThumbsDown = useCallback(() => {
    const newState = feedback === "down" ? null : "down";
    setFeedback(newState);
    if (newState && messageId) onFeedback(messageId, "THUMBS_DOWN");
  }, [feedback, messageId, onFeedback]);

  const handleRegenerate = useCallback(() => {
    if (messageId) onRegenerate(messageId);
  }, [messageId, onRegenerate]);

  return (
    <div className="flex items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={handleCopy}
        className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
        aria-label="Copy message"
      >
        {copied ? <Check className="size-3" weight="bold" /> : <Copy className="size-3" />}
      </button>
      <button
        onClick={handleThumbsUp}
        className={`size-6 flex items-center justify-center rounded-md transition-colors ${
          feedback === "up"
            ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
        }`}
        aria-label="Good response"
      >
        <ThumbsUp className="size-3" weight={feedback === "up" ? "fill" : "regular"} />
      </button>
      <button
        onClick={handleThumbsDown}
        className={`size-6 flex items-center justify-center rounded-md transition-colors ${
          feedback === "down"
            ? "text-red-600 bg-red-50 dark:bg-red-500/10"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
        }`}
        aria-label="Bad response"
      >
        <ThumbsDown className="size-3" weight={feedback === "down" ? "fill" : "regular"} />
      </button>
      <button
        onClick={handleRegenerate}
        className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
        aria-label="Regenerate response"
      >
        <ArrowClockwise className="size-3" />
      </button>
    </div>
  );
}

export function AssistantMessage() {
  const message = useMessage();

  let rawText = "";
  for (const part of message.content ?? []) {
    if (part.type === "text") {
      rawText += (part as { type: "text"; text: string }).text;
    }
  }

  const hasText = rawText.trim().length > 0;
  const messageId = message.id ?? "";

  if (!hasText) return null;

  return (
    <MessagePrimitive.Root className="group flex items-start w-full motion-safe:animate-[fade-in-up_0.3s_ease-out]">
      <div className="w-12 shrink-0 flex justify-center pt-0.5">
        <div className="size-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
          <span className="text-white text-xs font-bold">E</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="relative rounded-2xl bg-card/90 backdrop-blur-md border border-white/60 dark:border-white/[0.07] shadow-[0_2px_16px_rgba(0,0,0,0.07)] px-4 py-3">
          <MessagePrimitive.Content
            components={{ Text: StreamingMarkdownText }}
          />
        </div>
        <ActionBar rawText={rawText} messageId={messageId} />
      </div>
    </MessagePrimitive.Root>
  );
}
