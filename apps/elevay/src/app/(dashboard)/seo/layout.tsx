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
  '/seo': 'Dashboard',
  '/seo/chat': 'SEO & GEO',
  '/seo/pending': 'Pending review',
  '/seo/history': 'History',
  '/seo/scheduled': 'Scheduled reports',
};

export default function SeoLayout({ children }: { children: React.ReactNode }) {
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
  const isChat = pathname === '/seo/chat';

  return (
    <div className="flex h-full overflow-hidden">
      <SeoSidebar pendingCount={queue.data?.length} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {!isChat && (
          <header
            className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 sm:px-6"
            style={{ height: "48px", minHeight: "48px" }}
          >
            <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
            <div className="flex items-center gap-1.5">
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
        <main className="flex-1 flex flex-col overflow-hidden bg-elevay-page">
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
