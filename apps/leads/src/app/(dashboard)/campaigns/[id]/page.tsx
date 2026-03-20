"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { StatusBadge } from "@/components/campaigns/status-badge";
import { PipelineFlow } from "@/components/campaigns/pipeline-flow";

// ─── Types ──────────────────────────────────────────────

interface StepAnalytics {
  step: number;
  sent: number;
  opened: number;
  replied: number;
  bounced: number;
  openRate: number | null;
  replyRate: number | null;
}

interface CampaignDetail {
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
  stepAnalytics: StepAnalytics[];
  meetingsBooked: number;
}

const STEP_LABELS = [
  "Step 1 — PAS",
  "Step 2 — Value-add",
  "Step 3 — Social proof",
  "Step 4 — New angle",
  "Step 5 — Micro-value",
  "Step 6 — Breakup",
];

// ─── Component ──────────────────────────────────────────

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/trpc/campaign.getDetail?input=${encodeURIComponent(JSON.stringify({ id: params.id }))}`)
      .then((r) => r.json())
      .then((data) => {
        setCampaign(data?.result?.data ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="h-8 w-48 bg-muted/30 animate-pulse rounded mb-6" />
          <div className="h-32 bg-muted/30 animate-pulse rounded-xl mb-6" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-48 bg-muted/30 animate-pulse rounded-xl" />
            <div className="h-48 bg-muted/30 animate-pulse rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Campaign not found</p>
          <Link href="/campaigns" className="text-sm text-primary hover:underline">
            Back to campaigns
          </Link>
        </div>
      </div>
    );
  }

  const cache = campaign.analyticsCache;
  const sent = cache?.sent ?? 0;
  const opened = cache?.opened ?? 0;
  const replied = cache?.replied ?? 0;
  const bounced = cache?.bounced ?? 0;
  const replyRate = sent > 0 ? ((replied / sent) * 100).toFixed(1) : "—";
  const openRate = sent > 0 ? ((opened / sent) * 100).toFixed(1) : "—";
  const bounceRate = sent > 0 ? ((bounced / sent) * 100).toFixed(1) : "—";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Back link */}
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="size-4" />
          Campaigns
        </Link>

        {/* Campaign header */}
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-xl font-semibold">{campaign.name}</h1>
          <StatusBadge status={campaign.status} />
        </div>

        {/* Pipeline visualization — hero */}
        <div className="rounded-xl border bg-card px-4 py-2 mb-6">
          <PipelineFlow
            leadsTotal={campaign.leadsTotal}
            leadsScored={campaign.leadsScored}
            leadsEnriched={campaign.leadsEnriched}
            leadsDrafted={campaign.leadsDrafted}
            sent={sent}
            replied={replied}
            meetingsBooked={campaign.meetingsBooked}
            status={campaign.status}
          />
        </div>

        {/* 2-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: Step breakdown */}
          <div className="rounded-xl border bg-card px-4 py-4">
            <h2 className="text-sm font-semibold mb-3">Step Breakdown</h2>
            {campaign.stepAnalytics.length === 0 ? (
              <p className="text-xs text-muted-foreground">No step data yet</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground/60 border-b border-border/30">
                    <th className="text-left py-1.5 font-medium">Step</th>
                    <th className="text-right py-1.5 font-medium">Sent</th>
                    <th className="text-right py-1.5 font-medium">Opened</th>
                    <th className="text-right py-1.5 font-medium">Replied</th>
                    <th className="text-right py-1.5 font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.stepAnalytics.map((sa) => (
                    <tr key={sa.step} className="border-b border-border/10 last:border-0">
                      <td className="py-1.5 text-foreground/80">
                        {STEP_LABELS[sa.step] ?? `Step ${sa.step + 1}`}
                      </td>
                      <td className="text-right tabular-nums">{sa.sent}</td>
                      <td className="text-right tabular-nums">{sa.opened}</td>
                      <td className="text-right tabular-nums">{sa.replied}</td>
                      <td className="text-right tabular-nums">
                        {sa.sent > 0 ? `${((sa.replied / sa.sent) * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Right: Key metrics */}
          <div className="rounded-xl border bg-card px-4 py-4">
            <h2 className="text-sm font-semibold mb-3">Key Metrics</h2>
            <div className="space-y-3">
              <MetricRow label="Reply Rate" value={`${replyRate}%`} highlight={replied > 0} />
              <MetricRow label="Open Rate" value={`${openRate}%`} />
              <MetricRow label="Bounce Rate" value={`${bounceRate}%`} warn={bounced > 0 && sent > 0 && bounced / sent > 0.03} />
              <MetricRow label="Total Leads" value={campaign.leadsTotal.toLocaleString()} />
              <MetricRow label="Emails Sent" value={sent.toLocaleString()} />
              <MetricRow label="Meetings Booked" value={String(campaign.meetingsBooked)} highlight={campaign.meetingsBooked > 0} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/10 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`text-sm font-semibold tabular-nums ${
          highlight ? "text-emerald-600" : warn ? "text-red-400" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
