"use client";

import { Card } from "@leadsens/ui";

interface CampaignAnalyticsCardProps {
  campaign_id: string;
  campaign_name?: string;
  total_leads: number;
  contacted: number;
  emails_sent: number;
  emails_read: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
  new_leads_contacted: number;
  total_opportunities: number;
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex flex-col items-center px-2 py-1.5">
      <span className={`text-lg font-semibold tabular-nums ${highlight ? "text-green-400" : ""}`}>
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

export function CampaignAnalyticsCard({
  campaign_name,
  total_leads,
  contacted,
  emails_sent,
  emails_read,
  replied,
  bounced,
  unsubscribed,
  total_opportunities,
}: CampaignAnalyticsCardProps) {
  const openRate = emails_sent > 0 ? ((emails_read / emails_sent) * 100).toFixed(1) : "0";
  const replyRate = emails_sent > 0 ? ((replied / emails_sent) * 100).toFixed(1) : "0";
  const bounceRate = emails_sent > 0 ? ((bounced / emails_sent) * 100).toFixed(1) : "0";

  return (
    <Card className="overflow-hidden my-2">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">
          {campaign_name ? `Analytics — ${campaign_name}` : "Campaign Analytics"}
        </h3>
        <p className="text-xs text-muted-foreground">
          {total_leads} leads · {contacted} contacted
        </p>
      </div>

      <div className="px-4 py-3">
        <div className="grid grid-cols-4 gap-1 text-center">
          <Stat label="Sent" value={emails_sent} />
          <Stat label="Opened" value={emails_read} />
          <Stat label="Replied" value={replied} highlight />
          <Stat label="Bounced" value={bounced} />
        </div>

        <div className="mt-3 pt-3 border-t flex justify-between text-xs text-muted-foreground">
          <span>Open rate: <span className="text-foreground font-medium">{openRate}%</span></span>
          <span>Reply rate: <span className="text-foreground font-medium">{replyRate}%</span></span>
          <span>Bounce rate: <span className="text-foreground font-medium">{bounceRate}%</span></span>
        </div>

        {(unsubscribed > 0 || total_opportunities > 0) && (
          <div className="mt-2 pt-2 border-t flex justify-between text-xs text-muted-foreground">
            {unsubscribed > 0 && <span>Unsubscribed: {unsubscribed}</span>}
            {total_opportunities > 0 && (
              <span>Opportunities: <span className="text-green-400 font-medium">{total_opportunities}</span></span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
