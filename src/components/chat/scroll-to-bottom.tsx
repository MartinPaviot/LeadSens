"use client";

import { useThreadViewport } from "@assistant-ui/react";
import { ArrowDown } from "@phosphor-icons/react/dist/ssr";

export function ScrollToBottomPill() {
  const { isAtBottom, scrollToBottom } = useThreadViewport();

  if (isAtBottom) return null;

  return (
    <button
      type="button"
      onClick={() => scrollToBottom()}
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-sm bg-background/95 border shadow-md hover:shadow-lg transition-all cursor-pointer motion-safe:animate-[fade-in-up_0.2s_ease-out]"
      aria-label="Scroll to latest message"
    >
      <ArrowDown className="size-3.5" weight="bold" aria-hidden="true" />
    </button>
  );
}
