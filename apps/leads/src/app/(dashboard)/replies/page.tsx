"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowsClockwise,
  ArrowBendUpLeft,
  CalendarCheck,
  Archive,
  CheckCircle,
  Prohibit,
  PaperPlaneTilt,
  ChatCircleDots,
  Rocket,
} from "@phosphor-icons/react";
import { Button, Badge, cn } from "@leadsens/ui";
import { useAgentPanel } from "@/components/agent-panel/agent-panel-context";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────

interface ReplyCard {
  id: string;
  leadId: string;
  campaignId: string;
  status: string;
  category: string;
  sentiment: string;
  interestScore: number | null;
  leadName: string;
  leadTitle: string | null;
  leadCompany: string | null;
  leadEmail: string;
  leadIndustry: string | null;
  leadScore: number | null;
  campaignName: string;
  subject: string;
  bodyPreview: string;
  body: string;
  isAutoReply: boolean;
  receivedAt: string;
  aiSummary: string | null;
  updatedAt: string;
}

interface RepliesData {
  replies: ReplyCard[];
  nextCursor?: string;
  counts: {
    all: number;
    interested: number;
    not_interested: number;
    open: number;
    unread: number;
  };
}

// ─── Constants ──────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; dotColor: string; color: string; borderColor: string }> = {
  interested: { label: "Interested", dotColor: "bg-emerald-500", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20", borderColor: "border-l-emerald-500" },
  question: { label: "Question", dotColor: "bg-amber-500", color: "bg-amber-500/10 text-amber-700 border-amber-500/20", borderColor: "border-l-amber-500" },
  not_interested: { label: "Not interested", dotColor: "bg-red-500", color: "bg-red-500/10 text-red-700 border-red-500/20", borderColor: "border-l-red-500" },
  auto_reply: { label: "Auto-reply", dotColor: "bg-slate-400", color: "bg-slate-500/10 text-slate-600 border-slate-500/20", borderColor: "border-l-slate-300" },
  unclassified: { label: "New", dotColor: "bg-blue-500", color: "bg-blue-500/10 text-blue-700 border-blue-500/20", borderColor: "border-l-blue-500" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Component ──────────────────────────────────────────

export default function RepliesPage() {
  const agentPanel = useAgentPanel();
  const [data, setData] = useState<RepliesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch replies
  const fetchReplies = useCallback(async (categoryFilter?: string) => {
    try {
      const params: Record<string, unknown> = { limit: 50 };
      if (categoryFilter && categoryFilter !== "all") {
        params.category = categoryFilter;
      }
      const res = await fetch(
        "/api/trpc/replies.getAll?input=" + encodeURIComponent(JSON.stringify(params)),
      );
      const json = await res.json();
      if (json?.result?.data) {
        setData(json.result.data as RepliesData);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchReplies(filter);
  }, [fetchReplies, filter]);

  // Poll every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchReplies(filter), 60_000);
    return () => clearInterval(interval);
  }, [fetchReplies, filter]);

  // Sync from ESP
  const handleSync = useCallback(async () => {
    setSyncing(true);
    // Trigger the agent to sync replies
    agentPanel.open("Sync my latest replies from the ESP");
    setSyncing(false);
  }, [agentPanel]);

  // Archive a thread
  const handleArchive = useCallback(async (threadId: string) => {
    try {
      await fetch("/api/trpc/replies.archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId }),
      });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          replies: prev.replies.filter((r) => r.id !== threadId),
          counts: { ...prev.counts, all: prev.counts.all - 1 },
        };
      });
      toast.success("Archived");
    } catch {
      toast.error("Failed to archive");
    }
  }, []);

  // Mark as replied
  const handleMarkReplied = useCallback(async (threadId: string) => {
    try {
      await fetch("/api/trpc/replies.updateStatus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, status: "CLOSED" }),
      });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          replies: prev.replies.map((r) =>
            r.id === threadId ? { ...r, status: "CLOSED" } : r,
          ),
        };
      });
      toast.success("Marked as replied");
    } catch {
      toast.error("Failed to update");
    }
  }, []);

  const counts = data?.counts ?? { all: 0, interested: 0, not_interested: 0, open: 0, unread: 0 };
  const replies = data?.replies ?? [];

  // ─── Empty state ──────────────────────────────────────

  if (!loading && replies.length === 0 && filter === "all") {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold font-heading">Replies</h1>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <ChatCircleDots className="size-12 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold font-heading mb-1">No replies yet</h2>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
            Replies will appear here as prospects respond to your campaigns.
          </p>
          <Button onClick={() => agentPanel.open("Help me launch a campaign to start getting replies")}>
            <Rocket className="size-4 mr-1.5" />
            Launch a campaign
          </Button>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header — single line */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold font-heading">Replies</h1>
          <span className="text-sm text-muted-foreground">
            · {counts.all} total
            {counts.unread > 0 && (
              <> · <span className="text-foreground font-medium">{counts.unread} new</span></>
            )}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
        >
          <ArrowsClockwise className={cn("size-3.5 mr-1.5", syncing && "animate-spin")} />
          {syncing ? "Syncing..." : "Sync now"}
        </Button>
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <FilterPill
          label={`All (${counts.all})`}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <FilterPill
          label={`Interested (${counts.interested})`}
          dotColor="bg-emerald-500"
          active={filter === "interested"}
          onClick={() => setFilter("interested")}
        />
        <FilterPill
          label={`New (${counts.open})`}
          dotColor="bg-blue-500"
          active={filter === "unclassified"}
          onClick={() => setFilter("unclassified")}
        />
        <FilterPill
          label={`Not interested (${counts.not_interested})`}
          dotColor="bg-red-500"
          active={filter === "not_interested"}
          onClick={() => setFilter("not_interested")}
        />
      </div>

      {/* Reply rows */}
      {loading ? (
        <div className="space-y-0 border-t border-border/40">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-[72px] border-b border-border/40 bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : replies.length === 0 ? (
        <div className="text-center py-16">
          <ChatCircleDots className="size-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No replies in this category.
          </p>
        </div>
      ) : (
        <div className="border-t border-border/40">
          {replies.map((reply) => (
            <ReplyCardComponent
              key={reply.id}
              reply={reply}
              isExpanded={expandedId === reply.id}
              onToggleExpand={() => setExpandedId(expandedId === reply.id ? null : reply.id)}
              onReply={() => {
                agentPanel.open(
                  `Draft a reply to ${reply.leadName} from ${reply.leadCompany ?? "their company"}. They said: "${reply.bodyPreview.slice(0, 100)}". Original campaign: ${reply.campaignName}.`,
                );
              }}
              onBookMeeting={() => {
                agentPanel.open(
                  `Send a calendar link to ${reply.leadName} at ${reply.leadEmail} for a meeting this week. They replied to campaign "${reply.campaignName}".`,
                );
              }}
              onMarkReplied={() => handleMarkReplied(reply.id)}
              onArchive={() => handleArchive(reply.id)}
              onUnsubscribe={() => {
                handleArchive(reply.id);
                toast.success(`${reply.leadName} will be unsubscribed`);
              }}
            />
          ))}
        </div>
      )}

      {/* Caught up message */}
      {!loading && replies.length > 0 && !data?.nextCursor && (
        <p className="text-center text-xs text-muted-foreground/50 mt-6 mb-2">
          You&apos;re all caught up
        </p>
      )}

      {/* Load more */}
      {data?.nextCursor && (
        <div className="flex justify-center mt-4">
          <Button variant="outline" size="sm" onClick={() => {
            // Load more would go here
          }}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Filter Pill ────────────────────────────────────────

function FilterPill({
  label,
  dotColor,
  active,
  onClick,
}: {
  label: string;
  dotColor?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-xs px-2.5 py-1 rounded-full border transition-colors inline-flex items-center gap-1.5",
        active
          ? "bg-foreground text-background border-foreground"
          : "border-border text-muted-foreground hover:border-foreground/30",
      )}
    >
      {dotColor && <span className={cn("size-1.5 rounded-full shrink-0", active ? "bg-background" : dotColor)} />}
      {label}
    </button>
  );
}

// ─── Reply Card ─────────────────────────────────────────

function ReplyCardComponent({
  reply,
  isExpanded,
  onToggleExpand,
  onReply,
  onBookMeeting,
  onMarkReplied,
  onArchive,
  onUnsubscribe,
}: {
  reply: ReplyCard;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onReply: () => void;
  onBookMeeting: () => void;
  onMarkReplied: () => void;
  onArchive: () => void;
  onUnsubscribe: () => void;
}) {
  const config = CATEGORY_CONFIG[reply.category] ?? CATEGORY_CONFIG.unclassified;
  const isNew = reply.status === "OPEN";
  const tier = reply.leadScore != null
    ? reply.leadScore >= 9 ? "A" : reply.leadScore >= 7 ? "B" : reply.leadScore >= 5 ? "C" : "D"
    : null;

  const TIER_BADGE: Record<string, string> = {
    A: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    B: "bg-blue-500/10 text-blue-700 border-blue-500/20",
    C: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    D: "bg-red-500/10 text-red-700 border-red-500/20",
  };

  const isMuted = reply.category === "not_interested" || reply.category === "auto_reply";

  return (
    <div
      className={cn(
        "border-b border-border/40 border-l-[3px] px-3 py-2.5 cursor-pointer transition-colors hover:bg-accent/30",
        config.borderColor,
        isExpanded && "bg-accent/30",
        isMuted && "opacity-60",
        isNew && !isMuted && "bg-primary/[0.02]",
      )}
      onClick={onToggleExpand}
    >
      {/* Line 1: Name · Title · Company ... Campaign · Tier ... time */}
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className={cn("text-sm truncate", isNew && "font-semibold")}>
            {reply.leadName}
          </span>
          {reply.leadTitle && (
            <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
              · {reply.leadTitle}
            </span>
          )}
          {reply.leadCompany && (
            <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
              · {reply.leadCompany}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground/50 hidden md:inline ml-auto shrink-0">
            {reply.campaignName}
          </span>
          {tier && (
            <Badge variant="outline" className={`text-[9px] px-1 py-0 shrink-0 ${TIER_BADGE[tier]}`}>
              {tier}
            </Badge>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground/60 shrink-0 tabular-nums">
          {timeAgo(reply.receivedAt)}
        </span>
      </div>

      {/* Line 2: Body preview (single line unless expanded) */}
      <p className={cn(
        "text-xs leading-relaxed",
        isExpanded ? "text-foreground" : "text-foreground/80 line-clamp-1",
      )}>
        &ldquo;{isExpanded ? reply.body : reply.bodyPreview}&rdquo;
      </p>

      {/* Line 3: AI summary + inline actions */}
      <div className="flex items-center justify-between gap-2 mt-1">
        {reply.aiSummary ? (
          <p className="text-[11px] italic text-muted-foreground truncate flex-1">
            &#10024; {reply.aiSummary}
          </p>
        ) : (
          <span />
        )}
        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {(reply.category === "interested" || reply.category === "unclassified") && (
            <>
              <ActionButton icon={ArrowBendUpLeft} label="Reply" onClick={onReply} primary />
              <ActionButton icon={CalendarCheck} label="Book" onClick={onBookMeeting} />
              <ActionButton icon={CheckCircle} label="Done" onClick={onMarkReplied} />
              <ActionButton icon={Archive} label="Archive" onClick={onArchive} muted />
            </>
          )}
          {reply.category === "question" && (
            <>
              <ActionButton icon={ArrowBendUpLeft} label="Reply" onClick={onReply} primary />
              <ActionButton icon={PaperPlaneTilt} label="Info" onClick={onReply} />
              <ActionButton icon={CheckCircle} label="Done" onClick={onMarkReplied} />
              <ActionButton icon={Archive} label="Archive" onClick={onArchive} muted />
            </>
          )}
          {reply.category === "not_interested" && (
            <>
              <ActionButton icon={Prohibit} label="Unsub" onClick={onUnsubscribe} destructive />
              <ActionButton icon={Archive} label="Archive" onClick={onArchive} muted />
            </>
          )}
          {reply.category === "auto_reply" && (
            <ActionButton icon={Archive} label="Archive" onClick={onArchive} muted />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Action Button ──────────────────────────────────────

function ActionButton({
  icon: Icon,
  label,
  onClick,
  muted,
  destructive,
  primary,
}: {
  icon: typeof Archive;
  label: string;
  onClick: () => void;
  muted?: boolean;
  destructive?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md transition-colors",
        primary
          ? "text-primary font-medium hover:bg-primary/10"
          : destructive
            ? "text-red-600 hover:bg-red-500/10"
            : muted
              ? "text-muted-foreground hover:bg-muted/50"
              : "text-foreground/80 hover:bg-accent",
      )}
    >
      <Icon className="size-3" />
      {label}
    </button>
  );
}
