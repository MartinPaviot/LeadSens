"use client";

import { useQuery } from "@tanstack/react-query";
import type { ActivityItem } from "@/components/dashboard/activity-feed";
import { Rocket } from "@phosphor-icons/react";

const AGENT_NAMES: Record<string, string> = {
  'pio05': 'Performance report',
  'tsi07': 'Technical audit',
  'opt06': 'SEO optimizer',
  'kga08': 'Keyword planner',
  'mdg11': 'Meta descriptions',
  'alt12': 'ALT text generator',
  'wpw09': 'Page writer',
  'bsw10': 'Blog writer',
  'bpi01': 'Brand performance',
  'mts02': 'Market trends',
  'cia03': 'Competitive intel',
};

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  COMPLETED: { label: 'Completed', bg: 'rgba(23,195,178,0.1)', text: '#17C3B2' },
  FAILED: { label: 'Failed', bg: 'rgba(239,68,68,0.1)', text: '#ef4444' },
  PENDING_VALIDATION: { label: 'Pending', bg: 'rgba(245,158,11,0.1)', text: '#f59e0b' },
  PUBLISHED: { label: 'Published', bg: 'rgba(44,107,237,0.1)', text: '#2C6BED' },
  REJECTED: { label: 'Rejected', bg: 'rgba(113,113,122,0.1)', text: '#71717a' },
};

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

export default function HistoryPage() {
  const activity = useQuery<ActivityItem[]>({
    queryKey: ['dashboard', 'activity'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/activity');
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
    staleTime: 60_000,
  });

  const isEmpty = !activity.isLoading && (activity.data?.length ?? 0) === 0;

  return (
    <div className="flex-1 overflow-y-auto pb-16 sm:pb-0">
      <div className="p-4 sm:p-6 md:p-8">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/80 px-6 py-16 text-center">
            <Rocket size={40} weight="duotone" className="text-primary" />
            <p className="text-sm text-muted-foreground">No activity yet — run your first audit to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Agent</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Action</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {activity.data?.map((item) => {
                  const badge = STATUS_BADGE[item.status] ?? { label: item.status, bg: 'var(--muted)', text: 'var(--muted-foreground)' };
                  return (
                    <tr key={item.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {AGENT_NAMES[item.agentCode] ?? item.agentCode}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground max-w-[300px] truncate">
                        {item.summary}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: badge.bg, color: badge.text }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                        {formatDate(item.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
