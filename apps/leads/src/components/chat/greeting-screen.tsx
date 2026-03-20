"use client";

import { useMemo } from "react";
import { ThreadPrimitive, useThreadRuntime } from "@assistant-ui/react";
import {
  Check,
  Coins,
  UserPlus,
  Swap,
  GlobeHemisphereWest,
  Crown,
} from "@phosphor-icons/react";
import Image from "next/image";
import { useSession } from "@/lib/auth-client";
import { ICP_TAG_CATEGORIES } from "@/lib/icp-tag-colors";
import { CAMPAIGN_TEMPLATES } from "@/lib/campaign-templates";
import { LeadSensComposer } from "./composer";

// ─── Types ────────────────────────────────────────────────

interface Integration {
  type: string;
  status: string;
  accountEmail?: string | null;
}

interface DashboardData {
  tam: {
    total: number;
    burningEstimate: number;
    roles: string[];
  } | null;
  companyDna: {
    oneLiner: string;
    targetBuyers: Array<{ role?: string; sellingAngle?: string }>;
    differentiators: string[];
  } | null;
  weekStats: {
    sent: number;
    replied: number;
    meetings: number;
  } | null;
  activeCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    leadsTotal: number;
    leadsPushed: number;
    sent: number;
    replied: number;
    replyRate: string;
  }>;
  priorities: Array<{
    type: "replies" | "stalled" | "uncommitted" | "no_campaigns";
    label: string;
    action: string;
  }>;
  lastCampaign: {
    name: string;
    status: string;
    sent: number;
    replied: number;
    replyRate: string;
  } | null;
}

interface GreetingScreenProps {
  isStreaming: boolean;
  integrations: Integration[];
  dashboardData?: DashboardData | null;
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

type ParsedTag = { text: string; category: keyof typeof ICP_TAG_CATEGORIES };

const TEMPLATE_ICONS: Record<string, typeof Coins> = {
  Coins,
  UserPlus,
  Swap,
  GlobeHemisphereWest,
  Crown,
};

const FALLBACK_EXAMPLE_TEXT =
  "VP Sales in B2B SaaS, US + UK, 50 to 500 employees, revenue > $10M";

const FALLBACK_TAGS: ParsedTag[] = [
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
  dashboardData,
}: GreetingScreenProps) {
  const { data: session } = useSession();
  const runtime = useThreadRuntime();
  const activeIntegrations = integrations.filter((i) => i.status === "ACTIVE");
  const hasActiveTools = activeIntegrations.length > 0;
  const hasDna = !!dashboardData?.companyDna?.oneLiner;
  const hasTam = !!dashboardData?.tam;
  const hasWeekStats = !!dashboardData?.weekStats;
  const firstName = session?.user?.name?.split(" ")[0] ?? "";
  const greeting = getTimeGreeting();

  // Build dynamic ICP example from Company DNA targetBuyers, or fall back to hardcoded
  const { exampleText, parsedTags } = useMemo(() => {
    if (dashboardData?.companyDna?.targetBuyers?.length) {
      const buyer = dashboardData.companyDna.targetBuyers[0];
      if (buyer.role) {
        const angle = buyer.sellingAngle;
        const text = angle
          ? `${buyer.role} — ${angle}`
          : buyer.role;
        const tags: ParsedTag[] = [{ text: buyer.role, category: "role" }];
        return { exampleText: text, parsedTags: tags };
      }
    }
    return { exampleText: FALLBACK_EXAMPLE_TEXT, parsedTags: FALLBACK_TAGS };
  }, [dashboardData?.companyDna]);

  // Action handler: sends message to agent via the composer
  const handleAction = (action: string) => {
    runtime.composer.setText(action);
    runtime.composer.send();
  };

  // Greeting text varies based on state
  const greetingBody = hasActiveTools && hasDna
    ? "Ready when you are. Describe your target or pick an action below."
    : hasDna
      ? "I know your offer. Connect an email platform in *Settings > Integrations* to start sending, or describe your target below."
      : "I'm your prospecting copilot. **What's your website URL?** I'll analyze your offer and we can find leads right away.";

  // Whether to show the dashboard sections (TAM, stats, priorities)
  const showDashboard = hasTam || hasWeekStats || (dashboardData?.priorities?.length ?? 0) > 0;

  // Action chips for when tools are connected + DNA exists
  const ACTION_CHIPS = [
    { label: "Launch campaign", action: "Help me launch a new campaign" },
    { label: "Draft emails", action: "Draft personalized emails for my best leads" },
    { label: "Analyze results", action: "Show me campaign analytics and insights" },
    { label: "Show TAM", action: "Show my Total Addressable Market" },
  ];

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
                <Image src="/L.svg" alt="LeadSens" width={32} height={32} />
              </div>
            </div>
            <div className="flex-1 rounded-2xl bg-card/90 backdrop-blur-md border border-white/60 dark:border-white/[0.07] shadow-[0_2px_16px_rgba(0,0,0,0.07)] px-4 py-3 min-w-0">
              {/* Tool pills — only show at top when no dashboard sections */}
              {hasActiveTools && !showDashboard && (
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
                        {/* eslint-disable-next-line @next/next/no-img-element -- tiny decorative icons */}
                        <img src={meta.logo} alt="" className="size-3.5" />
                        {meta.name}
                        <Check weight="bold" className="size-3" />
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Company DNA summary (compact) */}
              {hasDna && !showDashboard && (
                <div className="mb-2 p-2.5 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-xs font-medium text-foreground/70 mb-1">Your Company DNA</p>
                  <p className="text-[13px] text-foreground/80">{dashboardData!.companyDna!.oneLiner}</p>
                  {dashboardData!.companyDna!.differentiators.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {dashboardData!.companyDna!.differentiators.slice(0, 3).map((d) => (
                        <span
                          key={d}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Greeting text */}
              <div className="text-[13.5px] leading-relaxed text-foreground/80">
                <p>
                  {greeting}{firstName ? `, ${firstName}` : ""}
                  {". "}
                  {hasActiveTools && hasDna && showDashboard
                    ? "How can I help?"
                    : greetingBody}
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-primary/60 ml-0.5 align-middle rounded-sm animate-pulse" />
                  )}
                </p>
              </div>

              {/* Connected user: minimal action chips */}
              {hasActiveTools && hasDna && showDashboard ? (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {ACTION_CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => handleAction(chip.action)}
                      className="text-xs px-3 py-1.5 rounded-full border border-border/40 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              ) : (
                /* New user: templates + DNA example */
                <div className="mt-2.5 pt-2.5 border-t border-border/30">
                  {hasDna ? (
                    <>
                      <p className="text-xs text-muted-foreground mb-2">
                        Based on your DNA:
                      </p>
                      <button
                        type="button"
                        onClick={() => runtime.composer.setText(exampleText)}
                        className="text-[13px] font-medium text-muted-foreground bg-background/50 rounded-lg px-3 py-2 border border-border/30 cursor-pointer hover:bg-background/80 transition-colors text-left w-full"
                      >
                        &ldquo;{exampleText}&rdquo;
                      </button>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {parsedTags.map((tag) => {
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
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground mb-2">
                        Start with a template:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {CAMPAIGN_TEMPLATES.slice(0, 4).map((tpl) => {
                          const Icon = TEMPLATE_ICONS[tpl.icon];
                          return (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => runtime.composer.setText(tpl.icpText)}
                              className="flex items-start gap-2 text-left rounded-lg px-3 py-2.5 border border-border/30 bg-background/50 hover:bg-background/80 transition-colors cursor-pointer"
                            >
                              {Icon && <Icon className="size-4 text-indigo-500 shrink-0 mt-0.5" weight="duotone" />}
                              <div className="min-w-0">
                                <p className="text-[12px] font-medium text-foreground/80 truncate">{tpl.title}</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {tpl.tags.slice(0, 2).map((tag) => {
                                    const cat = ICP_TAG_CATEGORIES[tag.category];
                                    return (
                                      <span
                                        key={tag.text}
                                        className="text-[10px] font-medium rounded-full px-1.5 py-0.5"
                                        style={{ backgroundColor: cat.bg, border: `1px solid ${cat.border}`, color: cat.text }}
                                      >
                                        {tag.text}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                        {/* 5th template spans full width */}
                        {CAMPAIGN_TEMPLATES[4] && (() => {
                          const tpl = CAMPAIGN_TEMPLATES[4];
                          const Icon = TEMPLATE_ICONS[tpl.icon];
                          return (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => runtime.composer.setText(tpl.icpText)}
                              className="col-span-2 flex items-center gap-2 text-left rounded-lg px-3 py-2.5 border border-border/30 bg-background/50 hover:bg-background/80 transition-colors cursor-pointer"
                            >
                              {Icon && <Icon className="size-4 text-indigo-500 shrink-0" weight="duotone" />}
                              <span className="text-[12px] font-medium text-foreground/80">{tpl.title}</span>
                              <div className="flex gap-1 ml-auto">
                                {tpl.tags.slice(0, 2).map((tag) => {
                                  const cat = ICP_TAG_CATEGORIES[tag.category];
                                  return (
                                    <span
                                      key={tag.text}
                                      className="text-[10px] font-medium rounded-full px-1.5 py-0.5"
                                      style={{ backgroundColor: cat.bg, border: `1px solid ${cat.border}`, color: cat.text }}
                                    >
                                      {tag.text}
                                    </span>
                                  );
                                })}
                              </div>
                            </button>
                          );
                        })()}
                      </div>
                    </>
                  )}

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
              )}

              {/* Tool pills (moved to bottom for compact view) */}
              {hasActiveTools && (
                <div className="mt-3 pt-2.5 border-t border-border/20 flex flex-wrap gap-1">
                  {activeIntegrations.map((integration) => {
                    const meta = TOOL_META[integration.type];
                    if (!meta) return null;
                    return (
                      <span
                        key={`bottom-${integration.type}`}
                        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 rounded-full px-2 py-0.5 border border-border/30"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- tiny decorative icons */}
                        <img src={meta.logo} alt="" className="size-3" />
                        {meta.name}
                      </span>
                    );
                  })}
                </div>
              )}
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
