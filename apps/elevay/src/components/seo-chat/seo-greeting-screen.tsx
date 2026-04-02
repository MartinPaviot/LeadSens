"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { PaperPlaneRight } from "@phosphor-icons/react";

// ─── Helpers ─────────────────────────────────────────────

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

// ─── Types ────────────────────────────────────────────────

export type SeoAction =
  | "tsi-audit"
  | "kga-audit"
  | "opt-audit"
  | "pio-audit"
  | "mdg-audit"
  | "alt-audit"
  | "wpw09-create"
  | "bsw10-create";

const SEO_QUICK_REPLIES: {
  id: string;
  label: string;
  description: string;
  action: SeoAction;
}[] = [
  { id: "tsi07", label: "🔍 Technical audit", description: "Crawl, indexation, Core Web Vitals", action: "tsi-audit" },
  { id: "kga08", label: "📊 Keyword strategy", description: "KW research + 90-day plan", action: "kga-audit" },
  { id: "opt06", label: "🚀 Optimize my pages", description: "Pages in position 4-15", action: "opt-audit" },
  { id: "pio05", label: "🧠 AI citability score", description: "Google SGE, Copilot, Perplexity", action: "pio-audit" },
  { id: "mdg11", label: "✍️ Generate metas", description: "CTR-optimized meta descriptions", action: "mdg-audit" },
  { id: "alt12", label: "🖼️ ALT texts images", description: "SEO images + WCAG accessibility", action: "alt-audit" },
  { id: "wpw09", label: "📝 Write a page", description: "Landing, service, about — SEO-optimized", action: "wpw09-create" },
  { id: "bsw10", label: "📰 Write an article", description: "Blog article + cluster + calendar", action: "bsw10-create" },
];

// ─── Component ────────────────────────────────────────────

interface SeoGreetingScreenProps {
  isStreaming: boolean;
  siteUrl?: string;
  onQuickReply?: (action: SeoAction) => void;
  onSend?: (message: string) => void;
}

export function SeoGreetingScreen({
  isStreaming,
  siteUrl,
  onQuickReply,
  onSend,
}: SeoGreetingScreenProps) {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "";
  const greeting = getTimeGreeting();
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && onSend) {
      onSend(input.trim());
      setInput("");
    }
  };

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Scrollable greeting area */}
      <div className="flex-1 overflow-y-auto px-4 pt-8 pb-4">
        <div className="mx-auto w-full max-w-3xl">
          <div className="rounded-2xl bg-card border border-border shadow-sm px-5 py-4">
            <div className="text-[13.5px] leading-relaxed text-foreground/80">
              <p>
                {greeting}{firstName ? `, ${firstName}` : ""}.{" "}
                I&apos;m your <strong>SEO & GEO</strong> Elevay assistant.
              </p>
              <p className="mt-1">
                {siteUrl ? (
                  <>
                    Configured site: <code className="text-xs bg-muted px-1 py-0.5 rounded">{siteUrl}</code>.{" "}
                    Choose an action to get started.
                  </>
                ) : (
                  <>
                    Set up your brand profile (site URL) in{" "}
                    <strong>settings</strong> to activate SEO agents.
                  </>
                )}
              </p>
            </div>

            {/* Quick actions grid */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {SEO_QUICK_REPLIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={isStreaming || !siteUrl}
                  onClick={() => onQuickReply?.(item.action)}
                  className="flex flex-col text-left text-[13px] font-medium text-foreground/80 bg-background border border-border rounded-lg px-3 py-2 cursor-pointer transition-colors duration-150 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{item.label}</span>
                  <span className="text-[11px] text-muted-foreground font-normal mt-0.5">
                    {item.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Simple input bar — no assistant-ui dependency */}
      <div className="shrink-0 border-t border-border bg-background px-4 py-3">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about SEO…"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white transition-opacity disabled:opacity-40"
            style={{ background: 'var(--elevay-gradient-btn)' }}
          >
            <PaperPlaneRight size={16} weight="fill" />
          </button>
        </form>
      </div>
    </div>
  );
}
