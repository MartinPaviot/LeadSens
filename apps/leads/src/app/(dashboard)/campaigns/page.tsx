"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Envelope,
  ChatCircle,
} from "@phosphor-icons/react";
import { Button, cn } from "@leadsens/ui";
import { useAgentPanel } from "@/components/agent-panel/agent-panel-context";
import { StatusBadge } from "@/components/campaigns/status-badge";
import { CompoundEffectCard } from "@/components/campaigns/compound-effect-card";

// ─── Types ──────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  status: string;
  icpDescription: string;
  leadsTotal: number;
  leadsScored: number;
  leadsEnriched: number;
  leadsDrafted: number;
  leadsPushed: number;
  leadsSkipped: number;
  createdAt: string;
  updatedAt: string;
  analyticsCache: {
    sent?: number;
    opened?: number;
    replied?: number;
    bounced?: number;
  } | null;
}

interface LearningStats {
  hasData: boolean;
  winningPatternsCount: number;
  styleCorrectionsCount: number;
  abTestsCompleted: number;
  winningSubjectsCount: number;
  replyRateTrend: Array<{ name: string; replyRate: number }>;
  campaignCount: number;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Component ──────────────────────────────────────────

export default function CampaignsPage() {
  const router = useRouter();
  const agentPanel = useAgentPanel();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch campaigns + learning stats in parallel
    Promise.all([
      fetch("/api/trpc/campaign.listWithAnalytics")
        .then((r) => r.json())
        .then((data) => data?.result?.data ?? []),
      fetch("/api/trpc/campaign.getLearningStats")
        .then((r) => r.json())
        .then((data) => data?.result?.data ?? null)
        .catch(() => null),
    ])
      .then(([campaignList, stats]) => {
        setCampaigns(campaignList as Campaign[]);
        setLearningStats(stats as LearningStats | null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Aggregate stats
  const totalSent = campaigns.reduce((sum, c) => sum + (c.analyticsCache?.sent ?? 0), 0);
  const totalReplied = campaigns.reduce((sum, c) => sum + (c.analyticsCache?.replied ?? 0), 0);
  const totalLeads = campaigns.reduce((sum, c) => sum + c.leadsTotal, 0);
  const overallReplyRate = totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(1) : "—";
  const activeCampaigns = campaigns.filter((c) => ["ACTIVE", "PUSHED", "MONITORING"].includes(c.status));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold font-heading">Campaigns</h1>
          <Button
            onClick={() => agentPanel.open("Help me create a new campaign")}
            className="inline-flex items-center gap-2"
          >
            <ChatCircle className="size-4" />
            New campaign
          </Button>
        </div>

        {/* Summary stat bar */}
        {campaigns.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-6 text-sm">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border font-medium tabular-nums">
              {activeCampaigns.length} active
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border text-foreground/80 tabular-nums">
              {totalLeads.toLocaleString("en-US")} leads
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border text-foreground/80 tabular-nums">
              {totalSent.toLocaleString("en-US")} sent
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium tabular-nums ${
              totalReplied > 0
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700"
                : "bg-card border text-foreground/80"
            }`}>
              {overallReplyRate}% reply rate
            </span>
          </div>
        )}

        {/* Compound effect card */}
        {learningStats?.hasData && (
          <div className="mb-6">
            <CompoundEffectCard stats={learningStats} />
          </div>
        )}

        {/* Campaign list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16">
            <Envelope className="size-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm mb-4">No campaigns yet</p>
            <Button
              onClick={() => agentPanel.open("Help me create my first campaign")}
              className="inline-flex items-center gap-2"
            >
              Create your first campaign
              <ArrowRight className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {campaigns.map((campaign, i) => (
              <CampaignRow
                key={campaign.id}
                campaign={campaign}
                index={i}
                onClick={() => router.push(`/campaigns/${campaign.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────

const CAMPAIGN_BORDER_COLORS = [
  "border-l-[#17C3B2]", // teal
  "border-l-[#2C6BED]", // blue
  "border-l-[#FF7A3D]", // orange
];

function replyRateColor(rate: number): string {
  if (rate > 5) return "text-emerald-600";
  if (rate >= 2) return "text-amber-600";
  return "text-red-500";
}

function CampaignRow({ campaign, onClick, index }: { campaign: Campaign; onClick: () => void; index: number }) {
  const sent = campaign.analyticsCache?.sent ?? 0;
  const opened = campaign.analyticsCache?.opened ?? 0;
  const replied = campaign.analyticsCache?.replied ?? 0;
  const replyRate = sent > 0 ? ((replied / sent) * 100) : 0;
  const replyRateStr = sent > 0 ? replyRate.toFixed(1) : "—";
  const openRate = sent > 0 ? ((opened / sent) * 100).toFixed(1) : "—";
  const progressPct = campaign.leadsTotal > 0 ? Math.round((sent / campaign.leadsTotal) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border bg-card hover:bg-accent/50 transition-colors px-4 py-3 group card-hover border-l-[3px]",
        CAMPAIGN_BORDER_COLORS[index % CAMPAIGN_BORDER_COLORS.length],
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">{campaign.name}</span>
            <StatusBadge status={campaign.status} />
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground truncate max-w-md">
              {campaign.icpDescription || "No ICP description"}
            </p>
            {/* Mini progress bar */}
            {campaign.leadsTotal > 0 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min(progressPct, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums">{sent}/{campaign.leadsTotal.toLocaleString("en-US")}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6 shrink-0 text-xs text-muted-foreground">
          <MetricCell label="Open" value={`${openRate}%`} />
          <MetricCell
            label="Reply"
            value={`${replyRateStr}%`}
            highlight={replied > 0}
            highlightColor={replied > 0 ? replyRateColor(replyRate) : undefined}
          />
          <span className="text-[11px] text-muted-foreground/50 w-16 text-right">
            {formatDate(campaign.updatedAt)}
          </span>
          <ArrowRight className="size-4 text-muted-foreground/30 group-hover:text-foreground/50 transition-colors" />
        </div>
      </div>
    </button>
  );
}

function MetricCell({ label, value, highlight, highlightColor }: { label: string; value: string | number; highlight?: boolean; highlightColor?: string }) {
  return (
    <div className="text-center w-14">
      <p className={`text-sm font-medium tabular-nums ${highlight ? (highlightColor ?? "text-emerald-600") : "text-foreground/80"}`}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground/50 uppercase">{label}</p>
    </div>
  );
}
