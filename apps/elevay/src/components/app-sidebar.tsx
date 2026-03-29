"use client";

import { useState, useMemo, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  SidebarSimple,
  PencilSimple,
  NotePencil,
  DotsThree,
  Trash,
  ChatCircle,
  MagnifyingGlass,
  Gear,
  SignOut,
  Globe,
  House,
} from "@phosphor-icons/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
  SidebarRail,
  useSidebar,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Input,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@leadsens/ui";
import { useSession, signOut } from "@/lib/auth-client";
import {
  useConversations,
  type ConversationSummary,
} from "@/components/conversation-provider";
import { SearchDialog } from "@/components/chat/search-dialog";
import { SettingsModal } from "@/components/chat/settings-modal";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { toast } from "sonner";

// ─── Date grouping ──────────────────────────────────────

interface ConversationGroup {
  label: string;
  conversations: ConversationSummary[];
}

function groupConversations(
  conversations: ConversationSummary[],
): ConversationGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const groups: Record<string, ConversationSummary[]> = {
    Today: [],
    Yesterday: [],
    "Last 7 days": [],
    "Last 30 days": [],
    Older: [],
  };

  for (const conv of conversations) {
    const date = new Date(conv.updatedAt);
    if (date >= today) {
      groups["Today"].push(conv);
    } else if (date >= yesterday) {
      groups["Yesterday"].push(conv);
    } else if (date >= weekAgo) {
      groups["Last 7 days"].push(conv);
    } else if (date >= monthAgo) {
      groups["Last 30 days"].push(conv);
    } else {
      groups["Older"].push(conv);
    }
  }

  return Object.entries(groups)
    .filter(([, convs]) => convs.length > 0)
    .map(([label, conversations]) => ({ label, conversations }));
}

// ─── Component ──────────────────────────────────────────

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const {
    activeId,
    conversations,
    selectConversation,
    startNewChat,
    refreshConversations,
  } = useConversations();

  const [renamingConv, setRenamingConv] = useState<{ id: string; title: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingConv, setDeletingConv] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const userName = session?.user?.name ?? "User";
  const userEmail = session?.user?.email ?? "";
  const firstName = userName.split(" ")[0] ?? "U";

  const groups = useMemo(
    () => groupConversations(conversations),
    [conversations],
  );

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  const handleNewChat = useCallback(() => {
    startNewChat();
    router.push("/chat");
    if (isMobile) setOpenMobile(false);
  }, [startNewChat, router, isMobile, setOpenMobile]);

  const handleSelect = (id: string) => {
    selectConversation(id);
    router.push("/chat");
    if (isMobile) setOpenMobile(false);
  };

  const handleSearchSelect = (id: string) => {
    selectConversation(id);
    router.push("/chat");
    if (isMobile) setOpenMobile(false);
  };

  const openRenameDialog = (id: string, currentTitle: string | null) => {
    setRenamingConv({ id, title: currentTitle ?? "Untitled" });
    setRenameValue(currentTitle ?? "");
  };

  const confirmRename = async () => {
    if (!renamingConv) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === renamingConv.title) {
      setRenamingConv(null);
      return;
    }
    try {
      await fetch("/api/trpc/conversation.rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: renamingConv.id, title: trimmed }),
      });
      await refreshConversations();
    } catch {
      toast.error("Failed to rename");
    }
    setRenamingConv(null);
  };

  const openDeleteDialog = (id: string) => {
    setDeletingConv(id);
  };

  const confirmDelete = async () => {
    if (!deletingConv) return;
    try {
      await fetch("/api/trpc/conversation.delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingConv }),
      });
      await refreshConversations();
      if (activeId === deletingConv) startNewChat();
    } catch {
      toast.error("Failed to delete");
    }
    setDeletingConv(null);
  };

  useKeyboardShortcuts({
    onSearch: () => setSearchOpen(true),
    onNewChat: handleNewChat,
  });

  return (
    <Sidebar
      collapsible="offcanvas"
      className="overflow-hidden"
      style={{
        background: "var(--background)",
        borderRight: "1px solid rgba(23,195,178,0.15)",
      }}
    >
      {/* Header */}
      <SidebarHeader className="px-3 py-1.5 border-b" style={{ borderColor: "rgba(23,195,178,0.15)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/logo-elevay.svg"
              alt="Elevay"
              width={22}
              height={22}
              className="shrink-0"
            />
            <span className="font-bold text-sm" style={{ color: "#17c3b2" }}>
              Elevay
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground"
            onClick={toggleSidebar}
          >
            <SidebarSimple className="size-3.5" />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 scrollbar-thin gap-0">
        {/* Mode nav — Accueil / Marketing / SEO & GEO */}
        <SidebarGroup className="pt-2 pb-0">
          <SidebarMenu className="gap-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/"}
                onClick={() => { router.push("/"); if (isMobile) setOpenMobile(false); }}
                size="sm"
                className="px-2 rounded-lg text-sidebar-foreground/70 hover:bg-[rgba(23,195,178,0.06)] data-[active=true]:bg-[rgba(23,195,178,0.10)] data-[active=true]:text-foreground"
              >
                <House className="size-3.5 shrink-0" />
                <span>Accueil</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/chat")}
                onClick={() => { router.push("/chat"); if (isMobile) setOpenMobile(false); }}
                size="sm"
                className="px-2 rounded-lg text-sidebar-foreground/70 hover:bg-[rgba(23,195,178,0.06)] data-[active=true]:bg-[rgba(23,195,178,0.10)] data-[active=true]:text-foreground"
              >
                <ChatCircle className="size-3.5 shrink-0" />
                <span>Marketing</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/seo-chat")}
                onClick={() => { router.push("/seo-chat"); if (isMobile) setOpenMobile(false); }}
                size="sm"
                className="px-2 rounded-lg text-sidebar-foreground/70 hover:bg-[rgba(23,195,178,0.06)] data-[active=true]:bg-[rgba(23,195,178,0.10)] data-[active=true]:text-foreground"
              >
                <Globe className="size-3.5 shrink-0" />
                <span>SEO & GEO</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* New conversation + Search */}
        <SidebarGroup className="pt-2 pb-1">
          <SidebarMenu className="gap-1.5">
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleNewChat}
                size="sm"
                className="w-full rounded-lg text-white font-medium justify-center"
                style={{ background: "var(--elevay-gradient-btn)" }}
              >
                <NotePencil className="size-3.5 shrink-0" />
                <span>New conversation</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setSearchOpen(true)}
                size="sm"
                className="px-2 rounded-lg text-sidebar-foreground/60 hover:bg-[rgba(23,195,178,0.06)]"
              >
                <MagnifyingGlass className="size-3.5" />
                <span className="truncate">Search</span>
                <kbd className="ml-auto text-[10px] text-muted-foreground/50">
                  Ctrl+K
                </kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Conversations */}
        {groups.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <ChatCircle className="size-8 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No conversations yet</p>
          </div>
        ) : (
          groups.map((group) => (
            <SidebarGroup key={group.label} className="py-1">
              <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/50 px-2">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {group.conversations.map((conv) => (
                    <SidebarMenuItem key={conv.id}>
                      <SidebarMenuButton
                        isActive={activeId === conv.id}
                        onClick={() => handleSelect(conv.id)}
                        size="sm"
                        className="px-3 rounded-lg text-sm text-foreground/70 hover:bg-[rgba(23,195,178,0.06)] data-[active=true]:bg-[rgba(23,195,178,0.10)] data-[active=true]:text-foreground"
                        title={conv.title ?? "Untitled"}
                      >
                        <span className="truncate">
                          {conv.title ?? "Untitled"}
                        </span>
                      </SidebarMenuButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuAction showOnHover>
                            <DotsThree className="size-4" weight="bold" />
                          </SidebarMenuAction>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="bottom" align="end" className="min-w-[140px]">
                          <DropdownMenuItem onClick={() => openRenameDialog(conv.id, conv.title)}>
                            <PencilSimple className="size-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(conv.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash className="size-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      {/* Footer — user info + settings */}
      <SidebarFooter
        className="px-3 py-3 border-t"
        style={{ borderColor: "rgba(23,195,178,0.15)" }}
      >
        <div className="flex items-center gap-2">
          <Avatar className="size-7 rounded-lg shrink-0">
            {session?.user?.image && (
              <AvatarImage src={session.user.image} alt={userName} className="rounded-lg" />
            )}
            <AvatarFallback
              className="rounded-lg text-[11px] font-bold text-white"
              style={{ background: "var(--elevay-gradient-btn)" }}
            >
              {firstName[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate text-foreground">{userName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
            >
              <Gear className="size-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  title="More"
                >
                  <DotsThree className="size-4" weight="bold" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="min-w-[160px]">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal truncate">
                  {userEmail}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <SignOut className="size-3.5 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />

      {/* Rename dialog */}
      <Dialog open={!!renamingConv} onOpenChange={(open) => { if (!open) setRenamingConv(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Conversation name"
              onKeyDown={(e) => { if (e.key === "Enter") void confirmRename(); }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingConv(null)}>
              Cancel
            </Button>
            <Button onClick={() => void confirmRename()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deletingConv} onOpenChange={(open) => { if (!open) setDeletingConv(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This conversation and all its messages will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Settings modal */}
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Search dialog */}
      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelect={handleSearchSelect}
      />
    </Sidebar>
  );
}
