"use client";

import { ThreadPrimitive } from "@assistant-ui/react";
import { useSession } from "@/lib/auth-client";
import { toast } from "sonner";
import { ElevayComposer } from "./composer";

// ─── Helpers ─────────────────────────────────────────────

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
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
            <div className="flex-1 rounded-2xl bg-card/90 backdrop-blur-md border border-white/60 dark:border-white/[0.07] shadow-[0_2px_16px_rgba(0,0,0,0.07)] px-4 py-3 min-w-0">
              <div className="text-[13.5px] leading-relaxed text-foreground/80">
                <p>
                  {greeting}{firstName ? `, ${firstName}` : ""}
                  {". "}
                  I&apos;m your AI marketing assistant. I can help with content strategy,
                  copywriting, campaign planning, and more.
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-primary/60 ml-0.5 align-middle rounded-sm animate-pulse" />
                  )}
                </p>
              </div>

              {/* Quick actions */}
              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-xs text-muted-foreground mb-2">Que souhaitez-vous faire ?</p>
                <div className="flex flex-col gap-1.5">
                  {/* BPI-01 — enabled */}
                  <button
                    type="button"
                    disabled={isStreaming}
                    onClick={() => onQuickReply?.("bpi-audit")}
                    className="text-xs font-medium text-foreground bg-background/50 rounded-lg px-3 py-2 border border-border/50 cursor-pointer hover:bg-background/80 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🔍 Auditer ma marque
                  </button>
                  {/* Row 2 — coming soon */}
                  <div className="flex gap-1.5">
                    {(["📈 Analyser les tendances", "🎯 Analyser mes concurrents"] as const).map(
                      (label) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => toast("Bientôt disponible")}
                          className="flex-1 text-xs font-medium text-muted-foreground bg-background/30 rounded-lg px-3 py-2 border border-border/20 cursor-pointer hover:bg-background/50 transition-colors opacity-60"
                        >
                          {label}
                        </button>
                      ),
                    )}
                  </div>
                </div>
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
