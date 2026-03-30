"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Lightning, Rocket, Sun, Moon } from "@phosphor-icons/react";
import { Button } from "@leadsens/ui";
import { useSession } from "@/lib/auth-client";
import { useTheme } from "next-themes";
import { SeoSidebar } from "@/components/dashboard/seo-sidebar";
import { ScoreCards } from "@/components/dashboard/score-cards";
import { ValidationQueue, type QueueItem } from "@/components/dashboard/validation-queue";
import { ActivityFeed, type ActivityItem } from "@/components/dashboard/activity-feed";
import { ChatOverlay } from "@/components/dashboard/chat-overlay";

// ─── Data fetching hooks ─────────────────────────────────

function useScores() {
  return useQuery({
    queryKey: ['dashboard', 'scores'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/scores');
      if (!res.ok) throw new Error('Failed to fetch scores');
      return res.json();
    },
    staleTime: 60_000,
  });
}

function useQueue() {
  return useQuery<QueueItem[]>({
    queryKey: ['dashboard', 'queue'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/queue');
      if (!res.ok) throw new Error('Failed to fetch queue');
      return res.json();
    },
    staleTime: 60_000,
  });
}

function useActivity() {
  return useQuery<ActivityItem[]>({
    queryKey: ['dashboard', 'activity'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/activity');
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
    staleTime: 60_000,
  });
}

// ─── Page component ──────────────────────────────────────

export default function DashboardPage() {
  const { data: sessionData } = useSession();
  const [chatOpen, setChatOpen] = useState(false);
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();

  const scores = useScores();
  const queue = useQueue();
  const activity = useActivity();

  const firstName = sessionData?.user?.name?.split(' ')[0] ?? '';

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
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'activity'] });
    },
  });

  const hasNoData =
    !scores.isLoading &&
    scores.data?.seoScore == null &&
    scores.data?.geoScore == null &&
    scores.data?.llmScore == null &&
    scores.data?.criticalIssues == null;

  return (
    <>
      <SeoSidebar pendingCount={queue.data?.length} onChatOpen={() => setChatOpen(true)} />

      <main className="flex-1 overflow-y-auto bg-elevay-mesh pb-16 sm:pb-0">
        {/* Topbar */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-6 sm:py-4 md:px-8">
          <div>
            <h1 className="text-base font-semibold text-foreground sm:text-lg">
              {firstName ? `Hello ${firstName}` : 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
            {/* New action CTA — gradient button matching brand */}
            <button
              onClick={() => setChatOpen(true)}
              className="hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:shadow-md sm:inline-flex"
              style={{ background: 'var(--elevay-gradient-btn)' }}
            >
              <Lightning size={16} weight="fill" />
              New action
            </button>
            {/* Mobile: icon-only */}
            <button
              onClick={() => setChatOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm sm:hidden"
              style={{ background: 'var(--elevay-gradient-btn)' }}
            >
              <Lightning size={16} weight="fill" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-5 p-4 sm:space-y-6 sm:p-6 md:p-8">
          {hasNoData ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/80 px-6 py-16 text-center backdrop-blur-sm">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: 'linear-gradient(135deg, rgba(23,195,178,0.15), rgba(44,107,237,0.1))' }}
              >
                <Rocket size={28} weight="duotone" className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Get started</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Run your first audit to see your scores
                </p>
              </div>
              <button
                onClick={() => setChatOpen(true)}
                className="mt-2 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-shadow hover:shadow-md"
                style={{ background: 'var(--elevay-gradient-btn)' }}
              >
                <Lightning size={16} weight="fill" />
                Run a full audit
              </button>
            </div>
          ) : (
            <>
              <ScoreCards scores={scores.data ?? null} isLoading={scores.isLoading} />

              {/* Bottom grid — stacks on mobile, side-by-side on desktop */}
              <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_340px]">
                <div className="space-y-5 sm:space-y-6">
                  <ValidationQueue
                    items={queue.data ?? []}
                    isLoading={queue.isLoading}
                    onApprove={(runId) => validateMutation.mutate({ runId, action: 'approve' })}
                    onReject={(runId) => validateMutation.mutate({ runId, action: 'reject' })}
                  />
                  <ActivityFeed
                    items={activity.data ?? []}
                    isLoading={activity.isLoading}
                  />
                </div>

                {/* Chat preview — desktop only */}
                <div className="hidden rounded-xl border border-border/40 bg-card/90 p-5 shadow-sm backdrop-blur-sm lg:block">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Agent SEO
                  </h2>
                  <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border/60">
                    <button
                      onClick={() => setChatOpen(true)}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      Open SEO chat
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <ChatOverlay open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
