"use client";

import { MessagePrimitive, useMessage } from "@assistant-ui/react";
import { StreamingMarkdownText, ActionBar } from "@leadsens/ui";
import { useBpiProgress } from "./bpi-progress-context";
import { AgentProgress } from "./agent-progress";

export function AssistantMessage() {
  const message = useMessage();
  const { modules, isExpanded, toggle, exportButton } = useBpiProgress();

  let rawText = "";
  for (const part of message.content ?? []) {
    if (part.type === "text") {
      rawText += (part as { type: "text"; text: string }).text;
    }
  }

  const hasText = rawText.trim().length > 0;
  const messageId = message.id ?? "";
  const isBpiRunning = modules !== null;

  if (!hasText && !isBpiRunning) return null;

  return (
    <MessagePrimitive.Root className="group flex items-start w-full motion-safe:animate-[fade-in-up_0.3s_ease-out]">
      <div className="w-12 shrink-0 flex justify-center pt-0.5">
        <div className="size-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
          <span className="text-white text-xs font-bold">E</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="relative rounded-2xl bg-card/90 backdrop-blur-md border border-white/60 dark:border-white/[0.07] shadow-[0_2px_16px_rgba(0,0,0,0.07)] px-4 py-3">
          {isBpiRunning && !hasText ? (
            <AgentProgress modules={modules} isExpanded={isExpanded} onToggle={toggle} />
          ) : (
            <MessagePrimitive.Content
              components={{ Text: StreamingMarkdownText }}
            />
          )}
          {exportButton !== null && message.id === exportButton.assistantId && (
            <button
              type="button"
              onClick={exportButton.onClick}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {exportButton.label}
            </button>
          )}
        </div>
        {hasText && <ActionBar rawText={rawText} messageId={messageId} />}
      </div>
    </MessagePrimitive.Root>
  );
}
