"use client";

import { Card, Badge } from "@leadsens/ui";
import {
  PaperPlaneTilt,
  EnvelopeOpen,
  ChatCircleDots,
  CalendarCheck,
  Pause,
  Play,
} from "@phosphor-icons/react";

// ─── Types ───────────────────────────────────────────────

interface RichCampaignCardProps {
  campaignId: string;
  campaignName: string;
  status: string;
  leadsTotal: number;
  leadsPushed: number;
  sent?: number;
  opened?: number;
  replied?: number;
  meetings?: number;
  replyRate?: string;
  latestReply?: {
    leadName: string;
    snippet: string;
    classification?: string;
  } | null;
}

// ─── Status Colors ───────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  PUSHED: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  MONITORING: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  DRAFT: "bg-muted text-muted-foreground border-border",
  READY: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
  PAUSED: "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  PUSHED: "Sending",
  MONITORING: "Monitoring",
  DRAFT: "Draft",
  READY: "Ready",
  PAUSED: "Paused",
};

// ─── Dispatch action to chat ─────────────────────────────

function dispatchAction(message: string) {
  window.dispatchEvent(
    new CustomEvent("leadsens:chat-action", { detail: { message } }),
  );
}

// ─── Component ───────────────────────────────────────────

export function RichCampaignCard({
  campaignId,
  campaignName,
  status,
  leadsTotal,
  leadsPushed,
  sent = 0,
  opened = 0,
  replied = 0,
  meetings = 0,
  replyRate,
  latestReply,
}: RichCampaignCardProps) {
  const pushPct = leadsTotal > 0 ? (leadsPushed / leadsTotal) * 100 : 0;
  const displayRate = replyRate ?? (sent > 0 ? ((replied / sent) * 100).toFixed(1) : "0");

  return (
    <Card className="overflow-hidden my-2">
      {/* Header */}
      <div className="px-4 py-2.5 border-b flex items-center gap-2">
        <PaperPlaneTilt weight="duotone" className="size-4 text-primary shrink-0" />
        <h3 className="text-sm font-semibold truncate flex-1">{campaignName}</h3>
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 shrink-0 ${STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT}`}
        >
          {STATUS_LABELS[status] ?? status}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-muted-foreground">
            Progress: {leadsPushed}/{leadsTotal} leads pushed
          </span>
          <span className="text-foreground/70 font-medium tabular-nums">
            {pushPct.toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(pushPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="px-4 py-3 grid grid-cols-4 gap-2">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <PaperPlaneTilt className="size-3 text-muted-foreground" />
            <span className="text-sm font-bold tabular-nums">{sent.toLocaleString()}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">Sent</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <EnvelopeOpen className="size-3 text-muted-foreground" />
            <span className="text-sm font-bold tabular-nums">{opened.toLocaleString()}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">Opened</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <ChatCircleDots className="size-3 text-emerald-600" />
            <span className="text-sm font-bold tabular-nums text-emerald-700">{replied}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">{displayRate}% replied</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <CalendarCheck className="size-3 text-primary" />
            <span className="text-sm font-bold tabular-nums">{meetings}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">Meetings</p>
        </div>
      </div>

      {/* Latest reply preview */}
      {latestReply && (
        <div className="px-4 pb-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <div className="flex items-center gap-1.5 mb-1">
              <ChatCircleDots weight="fill" className="size-3 text-emerald-600" />
              <span className="text-[11px] font-medium text-emerald-700">Latest reply from {latestReply.leadName}</span>
              {latestReply.classification && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 ml-auto">
                  {latestReply.classification}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-foreground/70 line-clamp-2">{latestReply.snippet}</p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-4 py-2.5 border-t flex gap-2">
        <button
          type="button"
          onClick={() => dispatchAction(`Show all replies for campaign ${campaignName}`)}
          className="flex-1 text-xs font-medium text-primary hover:bg-primary/5 rounded-lg py-1.5 transition-colors cursor-pointer"
        >
          View replies
        </button>
        {["ACTIVE", "PUSHED"].includes(status) && (
          <button
            type="button"
            onClick={() => dispatchAction(`Pause campaign ${campaignName}`)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
          >
            <Pause className="size-3" />
            Pause
          </button>
        )}
        {status === "PAUSED" && (
          <button
            type="button"
            onClick={() => dispatchAction(`Resume campaign ${campaignName}`)}
            className="flex items-center gap-1 text-xs text-primary hover:bg-primary/5 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
          >
            <Play className="size-3" />
            Resume
          </button>
        )}
      </div>
    </Card>
  );
}
