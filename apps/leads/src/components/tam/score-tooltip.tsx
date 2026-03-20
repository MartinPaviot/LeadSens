"use client";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Badge,
} from "@leadsens/ui";
import type { ReactNode } from "react";

// ─── Types ───────────────────────────────────────────────

interface ScoreTooltipProps {
  tier: "A" | "B" | "C" | "D";
  tierLabel: string;
  tierReasons: string[];
  heat: "Burning" | "Hot" | "Warm" | "Cold";
  heatLabel: string;
  heatReasons: string[];
  actionPhrase: string;
  children: ReactNode;
}

// ─── Colors ──────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  A: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  B: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  C: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  D: "bg-red-500/10 text-red-700 border-red-500/20",
};

const HEAT_COLORS: Record<string, string> = {
  Burning: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  Hot: "bg-rose-500/10 text-rose-700 border-rose-500/20",
  Warm: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  Cold: "bg-slate-500/10 text-slate-700 border-slate-500/20",
};

// ─── Component ───────────────────────────────────────────

export function ScoreTooltip({
  tier,
  tierLabel,
  tierReasons,
  heat,
  heatLabel,
  heatReasons,
  actionPhrase,
  children,
}: ScoreTooltipProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-3" side="top">
        {/* Action phrase */}
        <p className="text-xs font-semibold text-foreground mb-2.5">
          {actionPhrase}
        </p>

        {/* Tier section */}
        <div className="mb-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${TIER_COLORS[tier]}`}>
              Tier {tier}
            </Badge>
            <span className="text-[11px] text-muted-foreground">{tierLabel}</span>
          </div>
          <ul className="space-y-0.5">
            {tierReasons.map((reason, i) => (
              <li key={i} className="text-[11px] text-muted-foreground pl-2 border-l-2 border-border">
                {reason}
              </li>
            ))}
          </ul>
        </div>

        {/* Heat section */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${HEAT_COLORS[heat]}`}>
              {heat}
            </Badge>
            <span className="text-[11px] text-muted-foreground">{heatLabel}</span>
          </div>
          {heatReasons.length > 0 ? (
            <ul className="space-y-0.5">
              {heatReasons.map((reason, i) => (
                <li key={i} className="text-[11px] text-muted-foreground pl-2 border-l-2 border-border">
                  {reason}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground/60 pl-2">No signals detected</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
