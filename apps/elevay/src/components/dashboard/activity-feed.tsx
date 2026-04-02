"use client";

export interface ActivityItem {
  id: string;
  agentCode: string;
  status: string;
  summary: string;
  createdAt: string;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  isLoading: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-primary',
  PENDING_VALIDATION: 'bg-secondary',
  PUBLISHED: 'bg-accent',
  REJECTED: 'bg-muted-foreground',
  FAILED: 'bg-destructive',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSeconds = Math.round((now - then) / 1000);

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (diffSeconds < 60) return rtf.format(-diffSeconds, 'second');
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return rtf.format(-diffMinutes, 'minute');
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return rtf.format(-diffHours, 'hour');
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return rtf.format(-diffDays, 'day');
  const diffMonths = Math.round(diffDays / 30);
  return rtf.format(-diffMonths, 'month');
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-muted" />
          <div className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function ActivityFeed({ items, isLoading }: ActivityFeedProps) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Recent activity
      </h2>

      {isLoading ? (
        <Skeleton />
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No activity yet
        </p>
      ) : (
        <div className="relative max-h-72 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-3">
              <div
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_COLORS[item.status] ?? 'bg-gray-400'}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{item.summary}</p>
                <p className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</p>
              </div>
            </div>
          ))}
          {/* Fade overlay at bottom */}
          <div className="pointer-events-none sticky bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-card to-transparent" />
        </div>
      )}
    </div>
  );
}
