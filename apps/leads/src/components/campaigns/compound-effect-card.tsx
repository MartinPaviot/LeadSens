"use client";

import {
  Brain,
  Sparkle,
  Trophy,
  PencilLine,
  Flask,
  Target,
  TrendUp,
  TrendDown,
  Minus,
} from "@phosphor-icons/react";

interface LearningStats {
  hasData: boolean;
  winningPatternsCount: number;
  styleCorrectionsCount: number;
  abTestsCompleted: number;
  winningSubjectsCount: number;
  replyRateTrend: Array<{ name: string; replyRate: number }>;
  campaignCount: number;
}

export function CompoundEffectCard({ stats }: { stats: LearningStats }) {
  if (!stats.hasData) return null;

  const trend = stats.replyRateTrend;
  const maxRate = Math.max(...trend.map((t) => t.replyRate), 1);

  // Trend direction: compare last 2 campaigns with data
  const withData = trend.filter((t) => t.replyRate > 0);
  const trendDirection =
    withData.length >= 2
      ? withData[withData.length - 1].replyRate > withData[withData.length - 2].replyRate
        ? "up"
        : withData[withData.length - 1].replyRate < withData[withData.length - 2].replyRate
          ? "down"
          : "flat"
      : "flat";

  return (
    <div className="rounded-xl border bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-emerald-500/10 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Brain className="size-5 text-indigo-500" weight="duotone" />
        <span className="text-sm font-semibold">Your AI is Getting Smarter</span>
        <Sparkle className="size-4 text-amber-500" weight="fill" />
      </div>

      {/* Sparkline + trend */}
      <div className="flex items-end gap-3 mb-3">
        {/* Mini bars */}
        <div className="flex items-end gap-0.5 h-8 flex-1">
          {trend.map((point, i) => {
            const height = maxRate > 0 ? (point.replyRate / maxRate) * 100 : 0;
            const isLast = i === trend.length - 1;
            return (
              <div
                key={point.name}
                className={`w-1 rounded-t-sm transition-all ${
                  isLast ? "bg-emerald-500" : "bg-indigo-500/40"
                }`}
                style={{ height: `${Math.max(height, 4)}%` }}
                title={`${point.name}: ${point.replyRate}%`}
              />
            );
          })}
        </div>

        {/* Trend indicator */}
        <div className="flex items-center gap-1 shrink-0">
          {trendDirection === "up" && (
            <>
              <TrendUp className="size-4 text-emerald-500" weight="bold" />
              <span className="text-xs font-medium text-emerald-500">Improving</span>
            </>
          )}
          {trendDirection === "down" && (
            <>
              <TrendDown className="size-4 text-red-400" weight="bold" />
              <span className="text-xs font-medium text-red-400">Declining</span>
            </>
          )}
          {trendDirection === "flat" && (
            <>
              <Minus className="size-4 text-muted-foreground" weight="bold" />
              <span className="text-xs font-medium text-muted-foreground">Stable</span>
            </>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        <StatCell
          icon={Trophy}
          value={stats.winningPatternsCount + stats.winningSubjectsCount}
          label="patterns"
          color="text-amber-500"
        />
        <StatCell
          icon={PencilLine}
          value={stats.styleCorrectionsCount}
          label="style edits"
          color="text-violet-500"
        />
        <StatCell
          icon={Flask}
          value={stats.abTestsCompleted}
          label="A/B tests"
          color="text-blue-500"
        />
        <StatCell
          icon={Target}
          value={stats.campaignCount}
          label="campaigns"
          color="text-emerald-500"
        />
      </div>
    </div>
  );
}

function StatCell({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof Trophy;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Icon className={`size-3.5 ${color}`} weight="fill" />
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground/60 truncate">{label}</span>
    </div>
  );
}
