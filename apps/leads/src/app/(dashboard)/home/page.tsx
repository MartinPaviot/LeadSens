"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Warning,
  EnvelopeOpen,
  UsersFour,
  ChartBar,
  Rocket,
} from "@phosphor-icons/react";
import { Button, cn } from "@leadsens/ui";
import { useSession } from "@/lib/auth-client";
import { useAgentPanel } from "@/components/agent-panel/agent-panel-context";

// ─── Types ──────────────────────────────────────────────

interface DashboardData {
  tam: { total: number; burningEstimate: number; roles: string[] } | null;
  companyDna: { oneLiner: string; targetBuyers: Array<{ role?: string; sellingAngle?: string }>; differentiators: string[] } | null;
  weekStats: { sent: number; replied: number; meetings: number } | null;
  activeCampaigns: Array<{ id: string; name: string; status: string; leadsTotal: number; leadsPushed: number; sent: number; replied: number; replyRate: string }>;
  priorities: Array<{ type: "replies" | "stalled" | "uncommitted" | "no_campaigns"; label: string; action: string }>;
  lastCampaign: { name: string; status: string; sent: number; replied: number; replyRate: string } | null;
}

// ─── Helpers ────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

const PRIORITY_ICONS: Record<string, typeof Warning> = {
  replies: EnvelopeOpen,
  stalled: Warning,
  uncommitted: UsersFour,
  no_campaigns: ChartBar,
};

const PRIORITY_COLORS: Record<string, string> = {
  replies: "text-red-500",
  stalled: "text-amber-500",
  uncommitted: "text-blue-500",
  no_campaigns: "text-muted-foreground",
};

const CAMPAIGN_BORDER_COLORS = [
  "border-l-[#17C3B2]", // teal
  "border-l-[#2C6BED]", // blue
  "border-l-[#FF7A3D]", // orange
];

function replyRateColor(rateStr: string): string {
  const rate = parseFloat(rateStr);
  if (Number.isNaN(rate)) return "text-muted-foreground";
  if (rate > 5) return "text-emerald-600";
  if (rate >= 2) return "text-amber-600";
  return "text-red-500";
}

// ─── Component ──────────────────────────────────────────

export default function HomePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const agentPanel = useAgentPanel();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const firstName = session?.user?.name?.split(" ")[0] || "there";

  useEffect(() => {
    fetch("/api/trpc/workspace.getDashboardData")
      .then((r) => r.json())
      .then((res) => { if (res?.result?.data) setData(res.result.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = data?.weekStats;
  const campaigns = data?.activeCampaigns ?? [];
  const tam = data?.tam;
  const priorities = data?.priorities ?? [];
  const replyRate = stats && stats.sent > 0
    ? ((stats.replied / stats.sent) * 100).toFixed(1) + "%"
    : null;

  // ─── Loading skeleton ─────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="h-8 w-64 bg-muted/40 rounded-lg animate-pulse mb-4" />
        <div className="h-5 w-96 bg-muted/30 rounded animate-pulse mb-8" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-muted/20 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ─── Empty state (no campaigns, no TAM) ───────────────

  if (!campaigns.length && !tam) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-[28px] font-semibold tracking-tight mb-2">
          {getGreeting()}, {firstName}.
        </h1>
        <p className="text-[15px] text-muted-foreground mb-10 leading-relaxed">
          Welcome to LeadSens. Let&apos;s set up your first campaign.
        </p>

        <div className="border rounded-xl p-6 bg-card">
          <div className="flex items-start gap-4">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Rocket className="size-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium mb-1">Start your first campaign</p>
              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                Describe your target audience and LeadSens will find leads,
                write personalized emails, and launch your campaign.
              </p>
              <Button
                size="sm"
                onClick={() => agentPanel.open("Help me create my first campaign")}
              >
                Get started
                <ArrowRight className="size-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Briefing ─────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      {/* Greeting */}
      <h1 className="text-[28px] font-semibold tracking-tight mb-2">
        {getGreeting()}, {firstName}.
      </h1>

      {/* Stats as prose — Monaco style */}
      <p className="text-[15px] text-muted-foreground mb-4 leading-relaxed">
        {stats && stats.sent > 0 ? (
          <>
            This week, you&apos;ve sent{" "}
            <span className="text-foreground font-medium">{fmt(stats.sent)} emails</span>,
            received{" "}
            <span className={cn("font-medium", stats.replied > 0 ? "text-emerald-600" : "text-foreground")}>
              {fmt(stats.replied)} {stats.replied === 1 ? "reply" : "replies"}
            </span>
            {replyRate && <span className="text-muted-foreground/60"> ({replyRate})</span>}
            {stats.meetings > 0 && (
              <>, and booked{" "}
                <span className="text-foreground font-medium">
                  {stats.meetings} {stats.meetings === 1 ? "meeting" : "meetings"}
                </span>
              </>
            )}.{" "}
            {campaigns.length > 0 && (
              <span className="text-muted-foreground/60">
                {campaigns.length} active {campaigns.length === 1 ? "campaign" : "campaigns"}.
              </span>
            )}
          </>
        ) : campaigns.length > 0 ? (
          <>
            You have{" "}
            <span className="text-foreground font-medium">
              {campaigns.length} {campaigns.length === 1 ? "campaign" : "campaigns"}
            </span>{" "}
            running. No emails sent yet this week.
          </>
        ) : tam ? (
          <>
            Your market is mapped:{" "}
            <span className="text-foreground font-medium">{fmt(tam.total)} accounts</span>
            {tam.burningEstimate > 0 && (
              <>, <span className="text-amber-600 font-medium">~{fmt(tam.burningEstimate)} burning</span></>
            )}. Ready to launch your first campaign.
          </>
        ) : (
          <>All caught up. Nothing requires your attention right now.</>
        )}
      </p>

      {/* Priorities */}
      {priorities.length > 0 && (
        <section className="mb-4">
          <h2 className="font-heading text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium mb-2">
            Priorities
          </h2>
          <div className="space-y-0 divide-y divide-border/30">
            {priorities.map((p, i) => {
              const Icon = PRIORITY_ICONS[p.type] ?? Warning;
              const color = PRIORITY_COLORS[p.type] ?? "text-muted-foreground";
              return (
                <button
                  key={i}
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors text-left group"
                  onClick={() => {
                    if (p.type === "replies") router.push("/replies");
                    else agentPanel.open(p.action);
                  }}
                >
                  <Icon className={cn("size-4 shrink-0", color)} />
                  <span className="text-sm flex-1 min-w-0">{p.label}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Market summary — one compact line + penetration bar */}
      {tam && (
        <section className="mb-4">
          <h2 className="font-heading text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium mb-2">
            Market
          </h2>
          <button
            type="button"
            className="w-full flex flex-col gap-1.5 px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors text-left group"
            onClick={() => router.push("/market")}
          >
            <div className="flex items-center w-full">
              <span className="text-sm flex-1">
                <span className="font-medium tabular-nums">{fmt(tam.total)}</span>
                <span className="text-muted-foreground"> accounts</span>
                {tam.burningEstimate > 0 && (
                  <>
                    <span className="text-muted-foreground/40"> · </span>
                    <span className="text-amber-600 font-medium tabular-nums">{fmt(tam.burningEstimate)}</span>
                    <span className="text-muted-foreground"> burning</span>
                  </>
                )}
                {tam.roles.length > 0 && (
                  <>
                    <span className="text-muted-foreground/40"> · </span>
                    <span className="text-muted-foreground">{tam.roles.slice(0, 2).join(", ")}</span>
                  </>
                )}
              </span>
              <ArrowRight className="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
            </div>
            {/* TAM penetration bar */}
            {(() => {
              const totalContacted = campaigns.reduce((sum, c) => sum + c.sent, 0);
              const pct = tam.total > 0 ? (totalContacted / tam.total) * 100 : 0;
              return (
                <div className="flex items-center gap-2 w-full">
                  <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {pct.toFixed(1)}% penetrated
                  </span>
                </div>
              );
            })()}
          </button>
        </section>
      )}

      {/* Active campaigns — compact list */}
      {campaigns.length > 0 && (
        <section>
          <h2 className="font-heading text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium mb-2">
            Campaigns
          </h2>
          <div className="space-y-0 divide-y divide-border/30">
            {campaigns.slice(0, 5).map((c, i) => (
              <button
                key={c.id}
                type="button"
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-colors text-left group card-hover border-l-[3px]",
                  CAMPAIGN_BORDER_COLORS[i % CAMPAIGN_BORDER_COLORS.length],
                )}
                onClick={() => router.push(`/campaigns/${c.id}`)}
              >
                <span className="text-sm font-medium truncate flex-1 min-w-0">{c.name}</span>
                {/* Mini progress bar */}
                {c.leadsTotal > 0 && (
                  <div className="w-12 h-1 bg-border rounded-full overflow-hidden shrink-0">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min((c.sent / c.leadsTotal) * 100, 100)}%` }}
                    />
                  </div>
                )}
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {c.leadsTotal > 0 && c.leadsTotal >= c.sent
                    ? `${fmt(c.sent)}/${fmt(c.leadsTotal)} sent`
                    : `${fmt(c.sent)} sent`}
                </span>
                {c.replied > 0 && (
                  <span className={cn("text-xs tabular-nums shrink-0 font-medium", replyRateColor(c.replyRate))}>
                    {c.replyRate}%
                  </span>
                )}
                <ArrowRight className="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
