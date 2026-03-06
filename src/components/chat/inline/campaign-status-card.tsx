"use client";

import { Card } from "@/components/ui/card";

interface CampaignStatusCardProps {
  campaign_id: string;
  in_progress: number;
  not_yet_contacted: number;
  completed: number;
  leads_in_campaign: number;
}

function StatusBar({
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
        <span className="font-medium tabular-nums">
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

export function CampaignStatusCard(props: CampaignStatusCardProps) {
  const { in_progress, not_yet_contacted, completed, leads_in_campaign } = props;
  const total = leads_in_campaign;

  return (
    <Card className="overflow-hidden my-2">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">Sending Status</h3>
        <p className="text-xs text-muted-foreground">
          {total} leads in campaign
        </p>
      </div>

      <div className="px-4 py-3 space-y-3">
        <StatusBar label="Completed" value={completed} total={total} color="bg-green-500" />
        <StatusBar label="In Progress" value={in_progress} total={total} color="bg-blue-500" />
        <StatusBar label="Not Yet Contacted" value={not_yet_contacted} total={total} color="bg-muted-foreground/40" />
      </div>
    </Card>
  );
}
