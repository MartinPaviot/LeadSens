"use client";

import { ThreadPrimitive } from "@assistant-ui/react";
import { useSession } from "@/lib/auth-client";
import { ElevayComposer } from "@/components/chat/composer";

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
  {
    id: "tsi07",
    label: "🔍 Technical audit",
    description: "Crawl, indexation, Core Web Vitals",
    action: "tsi-audit",
  },
  {
    id: "kga08",
    label: "📊 Keyword strategy",
    description: "KW research + 90-day plan",
    action: "kga-audit",
  },
  {
    id: "opt06",
    label: "🚀 Optimize my pages",
    description: "Pages in position 4-15",
    action: "opt-audit",
  },
  {
    id: "pio05",
    label: "🧠 AI citability score",
    description: "Google SGE, Copilot, Perplexity visibility",
    action: "pio-audit",
  },
  {
    id: "mdg11",
    label: "✍️ Generate metas",
    description: "CTR-optimized meta descriptions",
    action: "mdg-audit",
  },
  {
    id: "alt12",
    label: "🖼️ ALT texts images",
    description: "SEO images + accessibilité WCAG",
    action: "alt-audit",
  },
  {
    id: "wpw09",
    label: "📝 Rédiger une page",
    description: "Landing, service, about — SEO-optimisé",
    action: "wpw09-create",
  },
  {
    id: "bsw10",
    label: "📰 Rédiger un article",
    description: "Article blog + cluster + calendrier",
    action: "bsw10-create",
  },
];

// ─── Component ────────────────────────────────────────────

interface SeoGreetingScreenProps {
  isStreaming: boolean;
  siteUrl?: string;
  onQuickReply?: (action: SeoAction) => void;
}

export function SeoGreetingScreen({
  isStreaming,
  siteUrl,
  onQuickReply,
}: SeoGreetingScreenProps) {
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
                <span className="text-white text-xs font-bold">S</span>
              </div>
            </div>
            <div className="flex-1 rounded-2xl bg-card/90 backdrop-blur-md border border-white/60 dark:border-white/[0.07] shadow-[0_2px_16px_rgba(0,0,0,0.07)] px-4 py-3 min-w-0 max-w-full overflow-hidden">
              <div className="text-[13.5px] leading-relaxed text-foreground/80">
                <p>
                  {greeting}{firstName ? `, ${firstName}` : ""}.{" "}
                  Je suis votre assistant <strong>SEO & GEO</strong> Elevay.
                </p>
                <p className="mt-1">
                  {siteUrl ? (
                    <>
                      Site configuré : <code className="text-xs bg-muted px-1 py-0.5 rounded">{siteUrl}</code>.{" "}
                      Choisissez une action pour démarrer.
                    </>
                  ) : (
                    <>
                      Configurez votre profil de marque (URL du site) dans les{" "}
                      <strong>paramètres</strong> pour activer les agents SEO.
                    </>
                  )}
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-primary/60 ml-0.5 align-middle rounded-sm animate-pulse" />
                  )}
                </p>
              </div>

              {/* Quick actions — 2-column grid */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                {SEO_QUICK_REPLIES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isStreaming || !siteUrl}
                    onClick={() => onQuickReply?.(item.action)}
                    className="flex flex-col text-left text-xs font-medium text-gray-700 bg-white border border-[#E5E7EB] rounded-[10px] px-3 py-2.5 cursor-pointer transition-colors duration-150 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
