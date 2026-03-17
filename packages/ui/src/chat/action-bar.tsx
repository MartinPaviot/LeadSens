"use client";

import { useState, useCallback } from "react";
import { Copy, Check, ThumbsUp, ThumbsDown, ArrowClockwise } from "@phosphor-icons/react";
import { useMessageActions } from "./message-actions-context";

interface ActionBarProps {
  rawText: string;
  messageId: string;
  cleanText?: (raw: string) => string;
}

export function ActionBar({ rawText, messageId, cleanText }: ActionBarProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const { onRegenerate, onFeedback } = useMessageActions();

  const handleCopy = useCallback(async () => {
    const text = cleanText ? cleanText(rawText) : rawText.trim();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [rawText, cleanText]);

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
        {copied ? (
          <Check className="size-3" weight="bold" />
        ) : (
          <Copy className="size-3" />
        )}
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
