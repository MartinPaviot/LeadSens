"use client";

import { ThreadPrimitive } from "@assistant-ui/react";
import { AssistantMessage } from "./assistant-message";
import { UserMessage } from "./user-message";
import { LeadSensComposer } from "./composer";
import { ScrollToBottomPill } from "./scroll-to-bottom";
import { ThinkingBlock } from "./thinking-block";

export function LeadSensThread({ isStreaming }: { isStreaming: boolean }) {
  return (
    <ThreadPrimitive.Root className="flex-1 flex flex-col min-h-0">
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto scrollbar-thin relative flex flex-col bg-leadsens-mesh">

        {/* Content column */}
        <div className="max-w-[720px] mx-auto w-full px-4 md:px-6 py-6 flex-1 space-y-5">
          <ThreadPrimitive.Messages
            components={{
              AssistantMessage,
              UserMessage,
            }}
          />

          {/* Thinking steps — appears after the last message during streaming */}
          <ThinkingBlock />
        </div>

        {/* Sticky footer */}
        <ThreadPrimitive.ViewportFooter className="sticky bottom-0 relative">
          {/* Layer 1: solid bg blocks messages underneath */}
          <div className="absolute inset-0 bg-background" />
          {/* Layer 2: mesh gradient for visual continuity */}
          <div className="absolute inset-0 bg-leadsens-mesh pointer-events-none" />
          {/* Layer 3: actual content */}
          <div className="relative">
            <ScrollToBottomPill />
            <LeadSensComposer />
          </div>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}

