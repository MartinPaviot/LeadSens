"use client";

import { useState } from "react";
import { CheckCircle, XCircle, ArrowSquareOut } from "@phosphor-icons/react";
import { Button } from "@leadsens/ui";

export interface QueueItem {
  id: string;
  agentCode: string;
  agentName: string;
  topic: string;
  draftUrl: string | null;
  createdAt: string;
}

interface ValidationQueueProps {
  items: QueueItem[];
  isLoading: boolean;
  onApprove: (runId: string) => void;
  onReject: (runId: string) => void;
}

const AGENT_COLORS: Record<string, string> = {
  'BSW-10': '#17C3B2',
  'WPW-09': '#17C3B2',
  'MDG-11': '#2C6BED',
  'TSI-07': '#F59E0B',
  'OPT-06': '#2C6BED',
  'ALT-12': '#FF7A3D',
};

function agentShortCode(code: string): string {
  return code.replace(/-\d+$/, '');
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
          <div className="h-9 w-9 animate-pulse rounded bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ValidationQueue({ items, isLoading, onApprove, onReject }: ValidationQueueProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visibleItems = items.filter((item) => !dismissedIds.has(item.id));

  function handleAction(runId: string, action: 'approve' | 'reject') {
    // Optimistic: remove from list immediately
    setDismissedIds((prev) => new Set(prev).add(runId));
    if (action === 'approve') onApprove(runId);
    else onReject(runId);
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card/90 p-5 shadow-sm backdrop-blur-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Pending review
      </h2>

      {isLoading ? (
        <Skeleton />
      ) : visibleItems.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <CheckCircle size={32} weight="duotone" className="text-emerald-500" />
          <p className="text-sm text-muted-foreground">
            Nothing pending — all up to date
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-lg border border-border/50 p-3 transition-opacity duration-300"
            >
              {/* Agent icon */}
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                style={{ backgroundColor: AGENT_COLORS[item.agentCode] ?? '#71717a' }}
              >
                {agentShortCode(item.agentCode)}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.topic}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.agentName} · {new Date(item.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1">
                {item.draftUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => window.open(item.draftUrl!, '_blank')}
                    title="View draft"
                  >
                    <ArrowSquareOut size={14} />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700"
                  onClick={() => handleAction(item.id, 'approve')}
                  title="Approve"
                >
                  <CheckCircle size={16} weight="fill" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                  onClick={() => handleAction(item.id, 'reject')}
                  title="Reject"
                >
                  <XCircle size={16} weight="fill" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
