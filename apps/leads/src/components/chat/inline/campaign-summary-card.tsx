"use client";

import { Card } from "@/components/ui/card";

interface CampaignSummaryCardProps {
  campaignName: string;
  totalLeads: number;
  scored: number;
  enriched: number;
  drafted: number;
  pushed: number;
  skipped: number;
}

function StatBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {value}/{total}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function CampaignSummaryCard({
  campaignName,
  totalLeads,
  scored,
  enriched,
  drafted,
  pushed,
  skipped,
}: CampaignSummaryCardProps) {
  return (
    <Card className="overflow-hidden my-2">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">{campaignName}</h3>
        <p className="text-xs text-muted-foreground">
          {totalLeads} leads total · {skipped} skipped
        </p>
      </div>

      <div className="px-4 py-3 space-y-3">
        <StatBar label="Scored" value={scored} total={totalLeads} color="bg-blue-500" />
        <StatBar label="Enriched" value={enriched} total={scored} color="bg-indigo-500" />
        <StatBar label="Drafted" value={drafted} total={enriched} color="bg-violet-500" />
        <StatBar label="Pushed" value={pushed} total={drafted} color="bg-green-500" />
      </div>
    </Card>
  );
}
