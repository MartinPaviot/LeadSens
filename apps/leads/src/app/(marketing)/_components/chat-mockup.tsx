"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useReducedMotion } from "../_hooks/use-reduced-motion";
import type { ChatReplayStep } from "../_data/chat-replay-steps";

interface ChatMockupProps {
  steps: ChatReplayStep[];
  /** If true, starts the replay automatically */
  autoPlay?: boolean;
  className?: string;
}

interface VisibleMessage {
  step: ChatReplayStep;
  showTyping: boolean;
}

export function ChatMockup({
  steps,
  autoPlay = true,
  className = "",
}: ChatMockupProps) {
  const prefersReducedMotion = useReducedMotion();
  const [messages, setMessages] = useState<VisibleMessage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const innerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    setMessages([]);
    setCurrentIndex(0);
  }, []);

  // P1: Show all messages immediately when reduced motion is preferred
  useEffect(() => {
    if (prefersReducedMotion) {
      setMessages(steps.map((step) => ({ step, showTyping: false })));
      setCurrentIndex(steps.length);
    }
  }, [prefersReducedMotion, steps]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (!autoPlay || currentIndex >= steps.length) {
      // Loop after all steps shown + a pause
      if (currentIndex >= steps.length) {
        const loopTimer = setTimeout(reset, 4000);
        return () => clearTimeout(loopTimer);
      }
      return;
    }

    const step = steps[currentIndex];
    const showDelay = currentIndex === 0 ? 500 : step.delay;

    const timer = setTimeout(() => {
      if (step.typingDuration && step.role === "assistant") {
        // Show typing first
        setMessages((prev) => [...prev, { step, showTyping: true }]);

        innerTimerRef.current = setTimeout(() => {
          setMessages((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, showTyping: false } : m
            )
          );
          setCurrentIndex((i) => i + 1);
          innerTimerRef.current = null;
        }, step.typingDuration);

        return;
      }

      setMessages((prev) => [...prev, { step, showTyping: false }]);
      setCurrentIndex((i) => i + 1);
    }, showDelay);

    return () => {
      clearTimeout(timer);
      if (innerTimerRef.current) {
        clearTimeout(innerTimerRef.current);
        innerTimerRef.current = null;
      }
    };
  }, [currentIndex, steps, autoPlay, reset, prefersReducedMotion]);

  return (
    <div
      className={`rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-2xl overflow-hidden ${className}`}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/30">
        <div className="flex gap-1.5">
          <div className="size-3 rounded-full bg-red-400/60" />
          <div className="size-3 rounded-full bg-yellow-400/60" />
          <div className="size-3 rounded-full bg-green-400/60" />
        </div>
        <span className="text-xs text-muted-foreground ml-2">LeadSens</span>
      </div>

      {/* Chat area */}
      <div className="p-4 space-y-3 min-h-[320px] max-h-[420px] overflow-hidden">
        {messages.map((msg, i) => (
          <ChatBubble key={i} message={msg} />
        ))}

        {/* Cursor when idle */}
        {messages.length === 0 && (
          <div className="flex items-start gap-3">
            <div className="size-7 rounded-lg overflow-hidden shrink-0 bg-white">
              <img src="/L.svg" alt="LeadSens" className="size-7" />
            </div>
            <div className="rounded-xl bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
              <span className="inline-block w-1.5 h-4 bg-primary/50 animate-pulse rounded-sm" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: VisibleMessage }) {
  const { step, showTyping } = message;
  const isUser = step.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in-up">
        <div className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm max-w-[85%]">
          {step.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 animate-fade-in-up">
      <div className="size-7 rounded-lg overflow-hidden shrink-0 bg-white">
        <img src="/L.svg" alt="LeadSens" className="size-7" />
      </div>
      <div className="flex-1 min-w-0">
        {showTyping ? (
          <div className="rounded-xl bg-muted/50 px-4 py-2.5 inline-flex gap-1">
            <span className="typing-dot size-1.5 rounded-full bg-muted-foreground/50" />
            <span className="typing-dot size-1.5 rounded-full bg-muted-foreground/50" />
            <span className="typing-dot size-1.5 rounded-full bg-muted-foreground/50" />
          </div>
        ) : (
          <>
            <div className="rounded-xl bg-muted/50 px-4 py-2.5 text-sm">
              {step.content}
            </div>
            {step.tags && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {step.tags.map((tag) => (
                  <span
                    key={tag.text}
                    className="text-xs font-medium rounded-full px-2.5 py-0.5"
                    style={{
                      backgroundColor: `${tag.color}12`,
                      border: `1px solid ${tag.color}33`,
                      color: tag.color,
                    }}
                  >
                    {tag.text}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
