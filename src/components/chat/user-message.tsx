"use client";

import { MessagePrimitive } from "@assistant-ui/react";

export function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end max-w-[85%] ml-auto motion-safe:animate-[fade-in-up_0.3s_ease-out]">
      <div className="rounded-[16px_16px_4px_16px] bg-primary/90 backdrop-blur-sm px-[18px] py-[10px] min-w-0 break-words">
        <MessagePrimitive.Content
          components={{
            Text: ({ text }) => (
              <p className="text-[13.5px] leading-relaxed text-primary-foreground">
                {text}
              </p>
            ),
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}
