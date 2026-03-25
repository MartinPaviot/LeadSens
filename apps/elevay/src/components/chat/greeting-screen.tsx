"use client";

import { ThreadPrimitive } from "@assistant-ui/react";
import { useSession } from "@/lib/auth-client";
import { ElevayComposer } from "./composer";

// ─── Helpers ─────────────────────────────────────────────

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

// ─── Component ────────────────────────────────────────────

interface GreetingScreenProps {
  isStreaming: boolean;
  onQuickReply?: (type: "bpi-audit" | "trends" | "competitors") => void;
}

export function GreetingScreen({ isStreaming, onQuickReply }: GreetingScreenProps) {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "";
  const greeting = getTimeGreeting();

  return (
    <ThreadPrimitive.Root className="flex-1 flex flex-col min-h-0">
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto scrollbar-thin relative flex flex-col">
        <div className="pointer-events-none absolute inset-0 bg-elevay-mesh" />

        <div className="max-w-[816px] mx-auto w-full px-4 md:pl-0 md:pr-12 py-6 flex-1">
          <div className="flex items-start w-full motion-safe:animate-[fade-in-up_0.3s_ease-out]">
            <div className="w-12 shrink-0 flex justify-center pt-0.5">
              <div
                className="size-8 rounded-lg flex items-center justify-center"
                style={{ background: "var(--elevay-gradient-btn)" }}
              >
                <span className="text-white text-xs font-bold">E</span>
              </div>
            </div>
            <div className="flex-1 rounded-2xl bg-card/90 backdrop-blur-md border border-white/60 dark:border-white/[0.07] shadow-[0_2px_16px_rgba(0,0,0,0.07)] px-4 py-3 min-w-0 max-w-full overflow-hidden">
              <div className="text-[13.5px] leading-relaxed text-foreground/80">
                <p>
                  {greeting}{firstName ? `, ${firstName}` : ""}.{" "}
                  I&apos;m Elevay, your AI marketing intelligence assistant.
                </p>
                <p className="mt-1">
                  I can audit your brand presence across 15+ sources, detect emerging market
                  trends before they peak, and run deep competitive analysis on up to 5
                  competitors.
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-primary/60 ml-0.5 align-middle rounded-sm animate-pulse" />
                  )}
                </p>
                <p className="mt-1">What would you like to do today?</p>
              </div>

              {/* Quick actions */}
              <div className="mt-4 flex flex-col sm:flex-row flex-wrap gap-2 w-full">
                <button
                  type="button"
                  disabled={isStreaming}
                  onClick={() => onQuickReply?.("bpi-audit")}
                  className="flex-1 min-w-0 text-xs font-medium text-gray-700 bg-white border border-[#E5E7EB] rounded-[10px] px-3 py-2 text-center whitespace-nowrap cursor-pointer transition-colors duration-150 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🔍 Audit my brand
                </button>
                <button
                  type="button"
                  disabled={isStreaming}
                  onClick={() => onQuickReply?.("trends")}
                  className="flex-1 min-w-0 text-xs font-medium text-gray-700 bg-white border border-[#E5E7EB] rounded-[10px] px-3 py-2 text-center whitespace-nowrap cursor-pointer transition-colors duration-150 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📈 Analyze market trends
                </button>
                <button
                  type="button"
                  disabled={isStreaming}
                  onClick={() => onQuickReply?.("competitors")}
                  className="flex-1 min-w-0 text-xs font-medium text-gray-700 bg-white border border-[#E5E7EB] rounded-[10px] px-3 py-2 text-center whitespace-nowrap cursor-pointer transition-colors duration-150 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🎯 Analyze my competitors
                </button>
              </div>
            </div>
          </div>
        </div>

        <ThreadPrimitive.ViewportFooter className="sticky bottom-0 relative">
          <div className="absolute inset-0 bg-background" />
          <div className="absolute inset-0 bg-elevay-mesh pointer-events-none" />
          <div className="relative">
            <ElevayComposer />
          </div>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}
