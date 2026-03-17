"use client";

import { ThreadPrimitive, useThreadRuntime } from "@assistant-ui/react";
import { Check } from "@phosphor-icons/react";
import { useSession } from "@/lib/auth-client";
import { ICP_TAG_CATEGORIES } from "@/lib/icp-tag-colors";
import { LeadSensComposer } from "./composer";

// ─── Types ────────────────────────────────────────────────

interface Integration {
  type: string;
  status: string;
  accountEmail?: string | null;
}

interface GreetingScreenProps {
  isStreaming: boolean;
  integrations: Integration[];
}

// ─── Constants ────────────────────────────────────────────

const TOOL_META: Record<string, { name: string; logo: string }> = {
  INSTANTLY:     { name: "Instantly",      logo: "/instantly.svg" },
  SMARTLEAD:     { name: "Smartlead",      logo: "/smartlead.svg" },
  LEMLIST:       { name: "Lemlist",        logo: "/logos/lemlist.png" },
  HUBSPOT:       { name: "HubSpot",        logo: "/hubspot.svg" },
  APOLLO:        { name: "Apollo",         logo: "/apollo.svg" },
  ZEROBOUNCE:    { name: "ZeroBounce",     logo: "/logos/zerobounce.png" },
  SALESFORCE:    { name: "Salesforce",      logo: "/salesforce.svg" },
  GOOGLE_SHEETS: { name: "Google Sheets",   logo: "/globe.svg" },
};

const EXAMPLE_TEXT =
  "VP Sales in B2B SaaS, US + UK, 50 to 500 employees, revenue > $10M";

const PARSED_TAGS: Array<{
  text: string;
  category: keyof typeof ICP_TAG_CATEGORIES;
}> = [
  { text: "VP Sales", category: "role" },
  { text: "B2B SaaS", category: "industry" },
  { text: "US + UK", category: "geo" },
  { text: "50 to 500 employees", category: "size" },
  { text: "> $10M", category: "revenue" },
];

// ─── Helpers ─────────────────────────────────────────────

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// ─── Component ────────────────────────────────────────────

export function GreetingScreen({
  isStreaming,
  integrations,
}: GreetingScreenProps) {
  const { data: session } = useSession();
  const runtime = useThreadRuntime();
  const activeIntegrations = integrations.filter((i) => i.status === "ACTIVE");
  const hasActiveTools = activeIntegrations.length > 0;
  const firstName = session?.user?.name?.split(" ")[0] ?? "";
  const greeting = getTimeGreeting();

  return (
    <ThreadPrimitive.Root className="flex-1 flex flex-col min-h-0">
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto scrollbar-thin relative flex flex-col">
        {/* Background mesh */}
        <div className="pointer-events-none absolute inset-0 bg-leadsens-mesh" />

        {/* Content column — same max-width as thread.tsx */}
        <div className="max-w-[816px] mx-auto w-full px-4 md:pl-0 md:pr-12 py-6 flex-1">
          {/* Chat bubble — mirrors assistant-message.tsx layout */}
          <div className="flex items-start w-full motion-safe:animate-[fade-in-up_0.3s_ease-out]">
            <div className="w-12 shrink-0 flex justify-center pt-0.5">
              <div className="size-8 rounded-lg overflow-hidden isolate" style={{ backgroundColor: '#fff' }}>
                <img src="/L.svg" alt="LeadSens" className="size-8 block" />
              </div>
            </div>
            <div className="flex-1 rounded-2xl bg-card/90 backdrop-blur-md border border-white/60 dark:border-white/[0.07] shadow-[0_2px_16px_rgba(0,0,0,0.07)] px-4 py-3 min-w-0">
              {/* Layer 1: Tool pills */}
              {hasActiveTools && (
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {activeIntegrations.map((integration) => {
                    const meta = TOOL_META[integration.type];
                    if (!meta) return null;
                    return (
                      <span
                        key={integration.type}
                        className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1"
                        style={{
                          backgroundColor: "rgba(16,185,129,0.07)",
                          border: "1px solid rgba(16,185,129,0.2)",
                          color: "#047857",
                        }}
                      >
                        <img src={meta.logo} alt="" className="size-3.5" />
                        {meta.name}
                        <Check weight="bold" className="size-3" />
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Layer 2: Greeting text */}
              <div className="text-[13.5px] leading-relaxed text-foreground/80">
                <p>
                  {greeting}{firstName ? `, ${firstName}` : ""}
                  {". "}
                  {hasActiveTools
                    ? "I've analyzed your offer and your tools are connected. Describe your target for this campaign: the more precise you are on role, industry, geo, company size and revenue, the more accurate sourcing will be."
                    : "connect your tools in Settings > Integrations to get started."}
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-primary/60 ml-0.5 align-middle rounded-sm animate-pulse" />
                  )}
                </p>
              </div>

              {/* Layer 3: Example with parsing */}
              <div className="mt-2.5 pt-2.5 border-t border-border/30">
                <p className="text-xs text-muted-foreground mb-2">
                  For example:
                </p>

                <button
                  type="button"
                  onClick={() => runtime.composer.setText(EXAMPLE_TEXT)}
                  className="text-[13px] font-medium text-muted-foreground bg-background/50 rounded-lg px-3 py-2 border border-border/30 cursor-pointer hover:bg-background/80 transition-colors text-left w-full"
                >
                  &ldquo;{EXAMPLE_TEXT}&rdquo;
                </button>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PARSED_TAGS.map((tag) => {
                    const cat = ICP_TAG_CATEGORIES[tag.category];
                    return (
                      <span
                        key={tag.text}
                        className="text-xs font-medium rounded-full px-2.5 py-1"
                        style={{
                          backgroundColor: cat.bg,
                          border: `1px solid ${cat.border}`,
                          color: cat.text,
                        }}
                      >
                        {tag.text}
                      </span>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  {Object.values(ICP_TAG_CATEGORIES).map((cat) => (
                    <span
                      key={cat.label}
                      className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/60"
                    >
                      <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.text }} />
                      {cat.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky composer — same 3-layer pattern as thread.tsx */}
        <ThreadPrimitive.ViewportFooter className="sticky bottom-0 relative">
          <div className="absolute inset-0 bg-background" />
          <div className="absolute inset-0 bg-leadsens-mesh pointer-events-none" />
          <div className="relative">
            <LeadSensComposer />
          </div>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}
