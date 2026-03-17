"use client";

import { Card } from "@/components/ui/card";

interface StepData {
  step: number;
  framework: string;
  sent: number;
  opened: number;
  replied: number;
  openRate: number;
  replyRate: number;
}

interface InsightData {
  dimension: string;
  topPerformer: { label: string; replyRate: number; sampleSize: number };
  bottomPerformer: { label: string; replyRate: number; sampleSize: number };
  recommendation: string;
  confidence: "high" | "medium" | "low";
}

interface TopLead {
  name: string;
  company: string | null;
  email: string;
  openCount: number;
  replyCount: number;
}

interface AnalyticsReportCardProps {
  campaignName: string;
  overview: {
    sent: number;
    opened: number;
    replied: number;
    bounced: number;
    openRate: number;
    replyRate: number;
    bounceRate: number;
  };
  stepBreakdown: StepData[];
  topLeads: TopLead[];
  insights: InsightData[];
}

/* ---------- small helpers ---------- */

function Stat({ label, value, rate }: { label: string; value: number; rate?: string }) {
  return (
    <div className="flex flex-col items-center px-2 py-1.5">
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      {rate !== undefined && (
        <span className="text-[10px] tabular-nums text-muted-foreground">{rate}%</span>
      )}
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const pctLabel = max > 0 ? `${pct.toFixed(1)}%` : "0%";

  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">
          {value} <span className="text-muted-foreground font-normal">({pctLabel})</span>
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function replyRateColor(rate: number): string {
  if (rate >= 8) return "bg-green-500";
  if (rate >= 4) return "bg-yellow-500";
  return "bg-red-500";
}

function confidenceBadge(confidence: "high" | "medium" | "low") {
  const styles: Record<string, string> = {
    high: "bg-green-500/15 text-green-400",
    medium: "bg-yellow-500/15 text-yellow-400",
    low: "bg-zinc-500/15 text-zinc-400",
  };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles[confidence]}`}>
      {confidence}
    </span>
  );
}

/* ---------- main component ---------- */

export function AnalyticsReportCard({
  campaignName,
  overview,
  stepBreakdown,
  topLeads,
  insights,
}: AnalyticsReportCardProps) {
  return (
    <Card className="overflow-hidden my-2">
      {/* ---- Header + overview stats ---- */}
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">Report — {campaignName}</h3>
        <div className="mt-2 grid grid-cols-4 gap-1 text-center">
          <Stat label="Sent" value={overview.sent} />
          <Stat label="Opened" value={overview.opened} rate={overview.openRate.toFixed(1)} />
          <Stat label="Replied" value={overview.replied} rate={overview.replyRate.toFixed(1)} />
          <Stat label="Bounced" value={overview.bounced} rate={overview.bounceRate.toFixed(1)} />
        </div>
      </div>

      {/* ---- Funnel visualization ---- */}
      <div className="px-4 py-3 border-b space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Funnel</p>
        <FunnelBar label="Sent" value={overview.sent} max={overview.sent} color="bg-blue-500" />
        <FunnelBar label="Opened" value={overview.opened} max={overview.sent} color="bg-indigo-500" />
        <FunnelBar label="Replied" value={overview.replied} max={overview.sent} color="bg-green-500" />
        <FunnelBar label="Bounced" value={overview.bounced} max={overview.sent} color="bg-red-500" />
      </div>

      {/* ---- Step breakdown ---- */}
      {stepBreakdown.length > 0 && (
        <div className="px-4 py-3 border-b">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Step Breakdown</p>
          <div className="space-y-2">
            {stepBreakdown.map((s) => (
              <div key={s.step} className="flex items-center gap-2 text-xs">
                <span className="w-5 shrink-0 tabular-nums text-muted-foreground text-right">
                  {s.step}
                </span>
                <span className="w-24 shrink-0 truncate" title={s.framework}>
                  {s.framework}
                </span>
                <div className="flex-1 flex items-center gap-1.5">
                  {/* open rate bar */}
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden" title={`Open ${s.openRate.toFixed(1)}%`}>
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${Math.min(s.openRate, 100)}%` }}
                    />
                  </div>
                  {/* reply rate bar */}
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden" title={`Reply ${s.replyRate.toFixed(1)}%`}>
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${replyRateColor(s.replyRate)}`}
                      style={{ width: `${Math.min(s.replyRate * 2.5, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="w-20 shrink-0 tabular-nums text-right text-muted-foreground">
                  {s.openRate.toFixed(1)}% / {s.replyRate.toFixed(1)}%
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
              <span className="w-5 shrink-0" />
              <span className="w-24 shrink-0" />
              <div className="flex-1 flex items-center gap-1.5">
                <span className="flex-1 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-indigo-500" /> Open
                </span>
                <span className="flex-1 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> Reply
                </span>
              </div>
              <span className="w-20 shrink-0" />
            </div>
          </div>
        </div>
      )}

      {/* ---- Top leads ---- */}
      {topLeads.length > 0 && (
        <div className="px-4 py-3 border-b">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Top Leads</p>
          <div className="space-y-1.5">
            {topLeads.slice(0, 5).map((lead) => (
              <div key={lead.email} className="flex items-center justify-between text-xs">
                <div className="min-w-0 flex-1">
                  <span className={lead.replyCount > 0 ? "font-semibold" : ""}>
                    {lead.name}
                  </span>
                  {lead.company && (
                    <span className="text-muted-foreground"> — {lead.company}</span>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-3 tabular-nums text-muted-foreground ml-2">
                  <span title="Opens">{lead.openCount} opens</span>
                  <span title="Replies" className={lead.replyCount > 0 ? "text-green-400 font-medium" : ""}>
                    {lead.replyCount} {lead.replyCount === 1 ? "reply" : "replies"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Insights ---- */}
      {insights.length > 0 && (
        <div className="px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Insights</p>
          <ul className="space-y-2">
            {insights.map((insight) => (
              <li key={insight.dimension} className="text-xs">
                <div className="flex items-start gap-2">
                  {confidenceBadge(insight.confidence)}
                  <div className="min-w-0">
                    <span className="font-medium">{insight.dimension}</span>
                    <span className="text-muted-foreground">
                      {" "}— best: {insight.topPerformer.label}{" "}
                      <span className="tabular-nums">({insight.topPerformer.replyRate.toFixed(1)}%, n={insight.topPerformer.sampleSize})</span>
                      {" "}· worst: {insight.bottomPerformer.label}{" "}
                      <span className="tabular-nums">({insight.bottomPerformer.replyRate.toFixed(1)}%, n={insight.bottomPerformer.sampleSize})</span>
                    </span>
                    <p className="text-muted-foreground mt-0.5">{insight.recommendation}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
