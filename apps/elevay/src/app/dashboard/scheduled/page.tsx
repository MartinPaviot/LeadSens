"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarCheck } from "@phosphor-icons/react";

const AGENT_NAMES: Record<string, string> = {
  pio05: 'Performance report',
  tsi07: 'Technical audit',
  opt06: 'SEO optimizer',
  kga08: 'Keyword planner',
  mdg11: 'Meta descriptions',
  alt12: 'ALT text generator',
};

interface ScheduleEntry {
  agentId: string;
  frequency: string;
  nextRunAt: string | null;
  status: 'active' | 'paused';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

export default function ScheduledPage() {
  const schedules = useQuery<ScheduleEntry[]>({
    queryKey: ['dashboard', 'schedules'],
    queryFn: async () => {
      // The schedule data is stored on the brand profile — fetch it
      const res = await fetch('/api/onboarding/profile');
      if (!res.ok) return [];
      const data = await res.json() as { profile: { report_recurrence?: string } | null };
      if (!data.profile?.report_recurrence || data.profile.report_recurrence === 'on_demand') {
        return [];
      }
      // Show a single entry for the global recurrence setting
      return [{
        agentId: 'pio05',
        frequency: data.profile.report_recurrence,
        nextRunAt: null,
        status: 'active' as const,
      }];
    },
    staleTime: 60_000,
  });

  const isEmpty = !schedules.isLoading && (schedules.data?.length ?? 0) === 0;

  return (
    <div className="flex-1 overflow-y-auto pb-16 sm:pb-0">
      <div className="p-4 sm:p-6 md:p-8">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/80 px-6 py-16 text-center">
            <CalendarCheck size={40} weight="duotone" className="text-primary" />
            <p className="text-sm text-muted-foreground">No scheduled reports — set up automation in SEO Settings</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Agent</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Frequency</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Next run</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {schedules.data?.map((entry) => (
                  <tr key={entry.agentId} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {AGENT_NAMES[entry.agentId] ?? entry.agentId}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground capitalize">
                      {entry.frequency}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {formatDate(entry.nextRunAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          backgroundColor: entry.status === 'active' ? 'rgba(23,195,178,0.1)' : 'rgba(113,113,122,0.1)',
                          color: entry.status === 'active' ? '#17C3B2' : '#71717a',
                        }}
                      >
                        {entry.status === 'active' ? 'Active' : 'Paused'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
