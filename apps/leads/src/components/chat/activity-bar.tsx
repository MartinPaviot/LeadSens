"use client";

import { useAgentActivity } from "./agent-chat";

export function ActivityBar({ isStreaming }: { isStreaming: boolean }) {
  const { label } = useAgentActivity();

  if (!isStreaming) return null;

  return (
    <div className="flex items-center gap-2.5 px-6 py-2 max-w-[720px] mx-auto w-full">
      <div className="flex items-center gap-1">
        <span className="size-1.5 rounded-full bg-indigo-500/80 typing-dot" />
        <span className="size-1.5 rounded-full bg-indigo-500/80 typing-dot [animation-delay:150ms]" />
        <span className="size-1.5 rounded-full bg-indigo-500/80 typing-dot [animation-delay:300ms]" />
      </div>
      <span className="text-xs text-muted-foreground motion-safe:animate-[fade-in-up_0.15s_ease-out]">
        {label || "LeadSens is thinking..."}
      </span>
    </div>
  );
}
