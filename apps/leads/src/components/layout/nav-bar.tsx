"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  House,
  ChatCircleDots,
  ChartBar,
  Target,
  Gear,
  ChatCircle,
  SignOut,
  Buildings,
  PlugsConnected,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import {
  Button,
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from "@leadsens/ui";
import { useSession, signOut } from "@/lib/auth-client";
import { useAgentPanel } from "@/components/agent-panel/agent-panel-context";
import { SearchDialog } from "@/components/chat/search-dialog";
import { useConversations } from "@/components/conversation-provider";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

// ─── Nav items ──────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: House },
  { href: "/replies", label: "Replies", icon: ChatCircleDots },
  { href: "/campaigns", label: "Campaigns", icon: ChartBar },
  { href: "/market", label: "Market", icon: Target },
] as const;

// ─── Component ──────────────────────────────────────────

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { toggle: toggleAgent, isOpen: agentOpen } = useAgentPanel();
  const { selectConversation } = useConversations();
  const [searchOpen, setSearchOpen] = useState(false);
  const [unreadReplies, setUnreadReplies] = useState(0);

  // Fetch unread reply count
  useEffect(() => {
    fetch("/api/trpc/replies.getUnreadCount")
      .then((r) => r.json())
      .then((d) => {
        const count = d?.result?.data?.count;
        if (typeof count === "number") setUnreadReplies(count);
      })
      .catch(() => {});

    // Poll every 60 seconds
    const interval = setInterval(() => {
      fetch("/api/trpc/replies.getUnreadCount")
        .then((r) => r.json())
        .then((d) => {
          const count = d?.result?.data?.count;
          if (typeof count === "number") setUnreadReplies(count);
        })
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const userName = session?.user?.name || "User";
  const userEmail = session?.user?.email || "";

  const handleLogout = useCallback(async () => {
    await signOut();
    router.push("/login");
  }, [router]);

  const handleSearchSelect = useCallback(
    (id: string) => {
      selectConversation(id);
      toggleAgent();
    },
    [selectConversation, toggleAgent],
  );

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSearch: () => setSearchOpen(true),
    onToggleAgent: toggleAgent,
  });

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Desktop nav */}
      <header className="hidden md:flex items-center justify-between px-4 h-11 border-b shadow-[0_1px_3px_rgba(0,0,0,0.04)] bg-background/95 backdrop-blur-sm shrink-0">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="size-5 rounded-md overflow-hidden bg-white">
            <Image src="/L.svg" alt="LeadSens" width={20} height={20} />
          </div>
          <span className="font-heading font-semibold text-sm">LeadSens</span>
        </Link>

        {/* Center: Nav links */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const badge = item.href === "/replies" && unreadReplies > 0 ? unreadReplies : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors relative",
                  active
                    ? "text-foreground border-b-2 border-primary rounded-b-none"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                )}
              >
                <Icon className="size-3.5" weight={active ? "fill" : "regular"} />
                {item.label}
                {badge > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold bg-red-500 text-white rounded-full">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setSearchOpen(true)}
            title="Search (Ctrl+K)"
          >
            <MagnifyingGlass className="size-3.5" />
          </Button>

          {/* Settings dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" title="Settings">
                <Gear className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal truncate">
                {userEmail}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings/integrations">
                  <PlugsConnected className="size-3.5 mr-2" />
                  Integrations
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/company-dna">
                  <Buildings className="size-3.5 mr-2" />
                  Company DNA
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <SignOut className="size-3.5 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Agent toggle */}
          <Button
            variant={agentOpen ? "default" : "ghost"}
            size="icon"
            className={cn(
              "size-7",
              agentOpen
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-primary/10 text-primary hover:bg-primary/20",
            )}
            onClick={toggleAgent}
            title="Agent panel (Cmd+J)"
          >
            <ChatCircle className="size-3.5" weight={agentOpen ? "fill" : "regular"} />
          </Button>

          {/* User avatar */}
          <Avatar className="size-6 ml-1">
            {session?.user?.image && (
              <AvatarImage src={session.user.image} alt={userName} />
            )}
            <AvatarFallback className="bg-indigo-500 text-white text-[10px]">
              {userName[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t bg-background/95 backdrop-blur-sm h-14 px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const badge = item.href === "/replies" && unreadReplies > 0 ? unreadReplies : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors relative",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <Icon className="size-5" weight={active ? "fill" : "regular"} />
                {badge > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[14px] h-3.5 px-0.5 text-[8px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={toggleAgent}
          className={cn(
            "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors",
            agentOpen ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <ChatCircle className="size-5" weight={agentOpen ? "fill" : "regular"} />
          Agent
        </button>
      </nav>

      {/* Search dialog */}
      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelect={handleSearchSelect}
      />
    </>
  );
}
