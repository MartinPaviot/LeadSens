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

interface CompanyDnaSummary {
  oneLiner: string | null;
  targetBuyers: Array<{ role?: string; sellingAngle?: string }>;
  differentiators: string[];
  problemsSolved: string[];
}

interface LastCampaignSummary {
  name: string;
  status: string;
  sent: number;
  replied: number;
  replyRate: string;
}

interface GreetingScreenProps {
  isStreaming: boolean;
  integrations: Integration[];
  companyDna?: CompanyDnaSummary | null;
  lastCampaign?: LastCampaignSummary | null;
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
  companyDna,
  lastCampaign,
}: GreetingScreenProps) {
  const { data: session } = useSession();
  const runtime = useThreadRuntime();
  const activeIntegrations = integrations.filter((i) => i.status === "ACTIVE");
  const hasActiveTools = activeIntegrations.length > 0;
  const hasDna = !!companyDna?.oneLiner;
  const firstName = session?.user?.name?.split(" ")[0] ?? "";
  const greeting = getTimeGreeting();

  // Build dynamic ICP example from Company DNA targetBuyers, or fall back to hardcoded
  const { exampleText, parsedTags } = useMemo(() => {
    if (companyDna?.targetBuyers?.length) {
      const buyer = companyDna.targetBuyers[0];
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
  }, [companyDna]);

  // Greeting text varies based on DNA + tools state — URL-first onboarding when no DNA
  const greetingBody = hasActiveTools && hasDna
    ? "I've analyzed your offer and your tools are connected. Describe your target for this campaign — or try the suggestion below."
    : hasDna
      ? "I know your offer. Connect an email platform in *Settings > Integrations* to start sending, or describe your target below to explore leads."
      : "I'm your prospecting copilot. **What's your website URL?** I'll analyze your offer and we can find leads right away.";

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
                        {/* eslint-disable-next-line @next/next/no-img-element -- tiny decorative icons, Image optimization adds overhead */}
                        <img src={meta.logo} alt="" className="size-3.5" />
                        {meta.name}
                        <Check weight="bold" className="size-3" />
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Layer 1.5: Company DNA summary */}
              {hasDna && (
                <div className="mb-2 p-2.5 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-xs font-medium text-foreground/70 mb-1">Your Company DNA</p>
                  <p className="text-[13px] text-foreground/80">{companyDna!.oneLiner}</p>
                  {companyDna!.differentiators.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {companyDna!.differentiators.slice(0, 3).map((d) => (
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

              {/* Layer 1.8: Last campaign summary */}
              {lastCampaign && (
                <div className="mb-2 p-2.5 rounded-lg bg-muted/30 border border-border/30 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-foreground/70">
                      Last campaign: <span className="text-foreground/90">{lastCampaign.name}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {lastCampaign.sent} sent · {lastCampaign.replied} replied · {lastCampaign.replyRate}% reply rate
                    </p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    ["ACTIVE", "PUSHED", "MONITORING"].includes(lastCampaign.status)
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {lastCampaign.status === "ACTIVE" ? "Active" :
                     lastCampaign.status === "MONITORING" ? "Monitoring" :
                     lastCampaign.status === "PUSHED" ? "Sending" :
                     lastCampaign.status.charAt(0) + lastCampaign.status.slice(1).toLowerCase()}
                  </span>
                </div>
              )}

              {/* Layer 2: Greeting text */}
              <div className="text-[13.5px] leading-relaxed text-foreground/80">
                <p>
                  {greeting}{firstName ? `, ${firstName}` : ""}
                  {". "}
                  {greetingBody}
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-primary/60 ml-0.5 align-middle rounded-sm animate-pulse" />
                  )}
                </p>
              </div>

              {/* Layer 3: Templates grid (no DNA) or DNA-based example */}
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

              {/* Social proof */}
              <div className="mt-3 pt-2.5 border-t border-border/20 flex items-center gap-4 text-[11px] text-muted-foreground/50">
                <span>Avg reply rate: <strong className="text-muted-foreground/70">8.7%</strong></span>
                <span className="size-0.5 rounded-full bg-muted-foreground/20" />
                <span>Emails personalized: <strong className="text-muted-foreground/70">50K+</strong></span>
                <span className="size-0.5 rounded-full bg-muted-foreground/20" />
                <span>Campaigns launched: <strong className="text-muted-foreground/70">340+</strong></span>
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
