"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";

interface PipelineStats {
  activeCampaigns: number;
  totalSent: number;
  totalReplied: number;
  replyRate: string;
}

export function PipelineStatusBar() {
  const [stats, setStats] = useState<PipelineStats | null>(null);

  const fetchStats = useCallback(() => {
    fetch("/api/trpc/campaign.listWithAnalytics")
      .then((r) => r.json())
      .then((data) => {
        const campaigns = data?.result?.data ?? [];
        if (campaigns.length === 0) {
          setStats(null);
          return;
        }

        const active = campaigns.filter(
          (c: { status: string }) => ["ACTIVE", "PUSHED", "MONITORING"].includes(c.status),
        );
        const totalSent = campaigns.reduce(
          (sum: number, c: { analyticsCache?: { sent?: number } | null }) =>
            sum + (c.analyticsCache?.sent ?? 0),
          0,
        );
        const totalReplied = campaigns.reduce(
          (sum: number, c: { analyticsCache?: { replied?: number } | null }) =>
            sum + (c.analyticsCache?.replied ?? 0),
          0,
        );
        const rate = totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(1) : "0";

        setStats({
          activeCampaigns: active.length,
          totalSent,
          totalReplied,
          replyRate: rate,
        });
      })
      .catch(() => {});
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Poll every 60s
  useEffect(() => {
    const interval = setInterval(fetchStats, 60_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Also refresh when stream completes
  useEffect(() => {
    const handler = () => {
      // Small delay to let analytics sync complete
      setTimeout(fetchStats, 2000);
    };
    window.addEventListener("leadsens:stream-complete", handler);
    return () => window.removeEventListener("leadsens:stream-complete", handler);
  }, [fetchStats]);

  if (!stats || (stats.activeCampaigns === 0 && stats.totalSent === 0)) {
    return null;
  }

  return (
    <Link
      href="/campaigns"
      className="flex items-center justify-between px-4 py-1 bg-muted/30 border-b text-[11px] text-muted-foreground hover:bg-muted/50 transition-colors group"
    >
      <div className="flex items-center gap-3">
        {stats.activeCampaigns > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {stats.activeCampaigns} active
          </span>
        )}
        {stats.totalSent > 0 && (
          <>
            <span className="text-muted-foreground/30">|</span>
            <span>{stats.totalSent.toLocaleString()} sent</span>
            <span className="text-muted-foreground/30">|</span>
            <span>
              {stats.totalReplied} replied{" "}
              <span className={Number(stats.replyRate) > 5 ? "text-emerald-600 font-medium" : ""}>
                ({stats.replyRate}%)
              </span>
            </span>
          </>
        )}
      </div>
      <ArrowRight className="size-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
    </Link>
  );
}
