"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Gear, Sun, Moon } from "@phosphor-icons/react";
import { Button } from "@leadsens/ui";
import { useTheme } from "next-themes";
import { SeoSidebar } from "@/components/dashboard/seo-sidebar";
import { SeoSettingsModal } from "@/components/dashboard/seo-settings-modal";
import { OnboardingOverlay } from "@/components/dashboard/onboarding-overlay";

interface QueueItem {
  id: string;
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/chat': 'SEO & GEO',
  '/dashboard/pending': 'Pending review',
  '/dashboard/history': 'History',
  '/dashboard/scheduled': 'Scheduled reports',
};

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [checkedProfile, setCheckedProfile] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const queue = useQuery<QueueItem[]>({
    queryKey: ['dashboard', 'queue'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/queue');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });

  // Check if brand profile exists
  useEffect(() => {
    if (checkedProfile) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/onboarding/profile');
        if (!res.ok || cancelled) { setCheckedProfile(true); return; }
        const data = await res.json() as { profile: unknown | null };
        if (!cancelled) setNeedsOnboarding(!data.profile);
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setCheckedProfile(true);
      }
    })();
    return () => { cancelled = true; };
  }, [checkedProfile]);

  const pageTitle = PAGE_TITLES[pathname] ?? 'Dashboard';
  const isChat = pathname === '/dashboard/chat';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SeoSidebar pendingCount={queue.data?.length} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Shared topbar — hidden on chat page (has its own header) */}
        {!isChat && (
          <header className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3 sm:px-6 md:px-8">
            <h1 className="text-sm font-semibold text-foreground sm:text-base">{pageTitle}</h1>
            <div className="flex items-center gap-1.5">
              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={async () => {
                    await fetch('/api/onboarding/profile', { method: 'DELETE' });
                    window.location.reload();
                  }}
                  className="rounded px-2 py-1 text-[10px] font-medium text-white bg-red-600 hover:bg-red-700"
                >
                  Reset profile
                </button>
              )}
              {mounted && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setSettingsOpen(true)}
              >
                <Gear size={16} />
              </Button>
            </div>
          </header>
        )}
        <main className="flex-1 flex flex-col overflow-hidden bg-elevay-mesh">
          {children}
        </main>
      </div>
      {needsOnboarding && (
        <OnboardingOverlay onComplete={() => setNeedsOnboarding(false)} />
      )}
      <SeoSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
