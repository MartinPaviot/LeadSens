"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ValidationQueue, type QueueItem } from "@/components/dashboard/validation-queue";
import { CheckCircle } from "@phosphor-icons/react";

export default function PendingPage() {
  const queryClient = useQueryClient();

  const queue = useQuery<QueueItem[]>({
    queryKey: ['dashboard', 'queue'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/queue');
      if (!res.ok) throw new Error('Failed to fetch queue');
      return res.json();
    },
    staleTime: 30_000,
  });

  const validateMutation = useMutation({
    mutationFn: async ({ runId, action }: { runId: string; action: 'approve' | 'reject' }) => {
      const res = await fetch('/api/agents/seo-geo/drafts/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, action }),
      });
      if (!res.ok) throw new Error('Validation failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'queue'] });
    },
  });

  const isEmpty = !queue.isLoading && (queue.data?.length ?? 0) === 0;

  return (
    <div className="flex-1 overflow-y-auto pb-16 sm:pb-0">
      <div className="p-4 sm:p-6 md:p-8">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/80 px-6 py-16 text-center">
            <CheckCircle size={40} weight="duotone" className="text-primary" />
            <p className="text-sm text-muted-foreground">Nothing pending — all up to date</p>
          </div>
        ) : (
          <ValidationQueue
            items={queue.data ?? []}
            isLoading={queue.isLoading}
            onApprove={(runId) => validateMutation.mutate({ runId, action: 'approve' })}
            onReject={(runId) => validateMutation.mutate({ runId, action: 'reject' })}
          />
        )}
      </div>
    </div>
  );
}
