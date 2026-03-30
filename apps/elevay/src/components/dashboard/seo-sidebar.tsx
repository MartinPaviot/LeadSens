"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  ChartBar,
  ClockCounterClockwise,
  CalendarCheck,
  UserCircle,
  List as ListIcon,
  CheckSquare,
  ChatCircle,
} from "@phosphor-icons/react";
import { useSession } from "@/lib/auth-client";
import { Avatar, AvatarFallback } from "@leadsens/ui";
import { trpc } from "@/lib/trpc-client";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  mobileVisible?: boolean;
}

interface SeoSidebarProps {
  pendingCount?: number;
  onChatOpen?: () => void;
}

export function SeoSidebar({ pendingCount, onChatOpen }: SeoSidebarProps) {
  const pathname = usePathname();
  const { data: sessionData } = useSession();
  const { data: brandProfile } = trpc.brandProfile.get.useQuery();
  const [mobileOpen, setMobileOpen] = useState(false);

  const user = sessionData?.user;
  const siteUrl = brandProfile?.brand_url ?? '';
  const displayUrl = siteUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

  const navItems: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: ChartBar, mobileVisible: true },
    { label: 'Pending review', href: '/dashboard/queue', icon: CheckSquare, badge: pendingCount, mobileVisible: true },
    { label: 'History', href: '/dashboard/history', icon: ClockCounterClockwise },
    { label: 'Scheduled reports', href: '/dashboard/schedules', icon: CalendarCheck },
    { label: 'Account', href: '/dashboard/settings', icon: UserCircle, mobileVisible: true },
  ];

  function isActive(href: string) {
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
  }

  // ─── Desktop + tablet sidebar content ───────────────────

  const sidebarContent = (
    <div
      className="flex h-full flex-col"
      style={{
        background: 'linear-gradient(180deg, #0e1117 0%, #131920 100%)',
      }}
    >
      {/* Logo */}
      <div className="px-4 pb-2 pt-5 lg:block">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: 'var(--elevay-gradient-btn)' }}
          >
            <span className="text-xs font-bold text-white">E</span>
          </div>
          <span
            className="hidden text-sm font-semibold lg:inline"
            style={{ color: 'var(--seo-sidebar-foreground)' }}
          >
            Elevay
          </span>
        </div>
      </div>

      {/* Site pill — desktop only */}
      {displayUrl && (
        <div className="mx-3 mb-4 mt-2 hidden lg:block">
          <div
            className="truncate rounded-md px-3 py-1.5 text-xs"
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              color: 'var(--seo-sidebar-muted)',
            }}
          >
            {displayUrl}
          </div>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 space-y-0.5 px-2">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150"
              title={item.label}
              style={{
                color: active ? '#ffffff' : 'var(--seo-sidebar-foreground)',
                background: active
                  ? 'linear-gradient(90deg, rgba(23,195,178,0.15), rgba(23,195,178,0.05))'
                  : 'transparent',
                borderLeft: active ? '2px solid var(--seo-sidebar-active)' : '2px solid transparent',
              }}
            >
              <Icon size={18} weight={active ? 'fill' : 'regular'} className="shrink-0" />
              <span className="hidden flex-1 lg:inline">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                  style={{ backgroundColor: 'var(--seo-sidebar-active)' }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t p-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback
              className="text-xs"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'var(--seo-sidebar-foreground)' }}
            >
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 flex-1 lg:block">
            <p className="truncate text-sm font-medium" style={{ color: 'var(--seo-sidebar-foreground)' }}>
              {user?.name ?? 'Utilisateur'}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--seo-sidebar-muted)' }}>
              Free
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Mobile bottom tab bar items ────────────────────────

  const mobileTabItems: NavItem[] = [
    ...navItems.filter((i) => i.mobileVisible),
    { label: 'Chat', href: '#chat', icon: ChatCircle, mobileVisible: true },
  ];

  return (
    <>
      {/* ─── Mobile bottom tab bar (< 640px) ───────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card sm:hidden">
        {mobileTabItems.map((item) => {
          const active = item.href === '#chat' ? false : isActive(item.href);
          const Icon = item.icon;
          return item.href === '#chat' ? (
            <button
              key="chat"
              onClick={onChatOpen}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-muted-foreground"
            >
              <Icon size={20} />
              <span className="text-[10px]">{item.label}</span>
            </button>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors"
              style={{ color: active ? 'var(--seo-sidebar-active)' : undefined }}
            >
              <div className="relative">
                <Icon size={20} weight={active ? 'fill' : 'regular'} />
                {item.badge != null && item.badge > 0 && (
                  <span
                    className="absolute -right-1.5 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[8px] font-bold text-white"
                    style={{ backgroundColor: 'var(--seo-sidebar-active)' }}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ─── Mobile slide-out sidebar overlay (legacy, > sm hidden) ─── */}
      <button
        className="fixed left-3 top-3 z-40 hidden rounded-md p-2"
        style={{ backgroundColor: 'var(--seo-sidebar)', color: 'var(--seo-sidebar-foreground)' }}
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <ListIcon size={20} />
      </button>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ─── Sidebar: icon-only on tablet (sm–lg), full on desktop (lg+) ─── */}
      <aside
        className="hidden shrink-0 sm:block sm:w-[60px] lg:w-[220px]"
      >
        {sidebarContent}
      </aside>
    </>
  );
}
