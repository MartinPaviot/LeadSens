"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Buildings,
  SignOut,
  SidebarSimple,
  PencilSimple,
  NotePencil,
  DotsThree,
  Trash,
  ChatCircle,
  PlugsConnected,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import Link from "next/link";
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
} from "@/components/ui/sidebar";
import { useSession, signOut } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useConversations,
  type ConversationSummary,
} from "@/components/conversation-provider";
import { SearchDialog } from "@/components/chat/search-dialog";
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
  const { data: session } = useSession();
  const { toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const {
    activeId,
    conversations,
    selectConversation,
    startNewChat,
    refreshConversations,
  } = useConversations();

  // Workspace name
  const [workspaceName, setWorkspaceName] = useState("Workspace");
  const [editWorkspaceOpen, setEditWorkspaceOpen] = useState(false);
  const [editingWorkspaceName, setEditingWorkspaceName] = useState("");

  // Rename conversation dialog
  const [renamingConv, setRenamingConv] = useState<{ id: string; title: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Delete conversation dialog
  const [deletingConv, setDeletingConv] = useState<string | null>(null);

  // Search dialog
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("workspaceName");
    if (saved) setWorkspaceName(saved);
  }, []);

  const handleSaveWorkspaceName = () => {
    const trimmed = editingWorkspaceName.trim();
    if (trimmed) {
      setWorkspaceName(trimmed);
      localStorage.setItem("workspaceName", trimmed);
    }
    setEditWorkspaceOpen(false);
  };

  const openEditWorkspace = () => {
    setEditingWorkspaceName(workspaceName);
    setEditWorkspaceOpen(true);
  };

  const userName = session?.user?.name || "User";
  const userEmail = session?.user?.email || "";
  const firstName = userName.split(" ")[0];

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

  // ── Rename: open dialog ──
  const openRenameDialog = (id: string, currentTitle: string | null) => {
    setRenamingConv({ id, title: currentTitle || "Untitled" });
    setRenameValue(currentTitle || "");
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

  // ── Delete: open dialog ──
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

  // ── Keyboard shortcuts ──
  useKeyboardShortcuts({
    onSearch: () => setSearchOpen(true),
    onNewChat: handleNewChat,
  });

  return (
    <Sidebar collapsible="offcanvas" className="overflow-hidden">
      {/* ── Header: Logo + actions ── */}
      <SidebarHeader className="px-3 py-1.5 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-5 rounded-md overflow-hidden bg-white">
              <img src="/L.svg" alt="LeadSens" className="size-5" />
            </div>
            <span className="font-semibold text-xs">LeadSens</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={toggleSidebar}
          >
            <SidebarSimple className="size-3.5" />
          </Button>
        </div>
      </SidebarHeader>

      {/* ── Content: Nav + Conversation list ── */}
      <SidebarContent className="px-2 scrollbar-thin gap-0">
        <SidebarGroup className="pt-1 pb-0">
          <SidebarMenu className="gap-0.5">
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleNewChat}
                size="sm"
                className="px-2 rounded-lg text-sidebar-foreground/60"
              >
                <NotePencil className="size-3" />
                <span className="truncate">New conversation</span>
                <kbd className="ml-auto text-[10px] text-muted-foreground/50">
                  Ctrl+Shift+O
                </kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setSearchOpen(true)}
                size="sm"
                className="px-2 rounded-lg text-sidebar-foreground/60"
              >
                <MagnifyingGlass className="size-3" />
                <span className="truncate">Search</span>
                <kbd className="ml-auto text-[10px] text-muted-foreground/50">
                  Ctrl+K
                </kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                size="sm"
                className="px-2 rounded-lg text-sidebar-foreground/60"
              >
                <Link href="/settings/integrations">
                  <PlugsConnected className="size-3" />
                  <span className="truncate">Integrations</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                size="sm"
                className="px-2 rounded-lg text-sidebar-foreground/60"
              >
                <Link href="/company-dna">
                  <Buildings className="size-3" />
                  <span className="truncate">Company DNA</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        {groups.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <ChatCircle className="size-8 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              No conversations
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <SidebarGroup key={group.label} className="py-1">
              <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/60 px-2">
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
                        className="px-2 rounded-lg text-sidebar-foreground/60 data-[active=true]:text-sidebar-accent-foreground"
                        title={conv.title || "Untitled"}
                      >
                        <span className="truncate">
                          {conv.title || "Untitled"}
                        </span>
                      </SidebarMenuButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuAction showOnHover>
                            <DotsThree className="size-4" weight="bold" />
                          </SidebarMenuAction>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="bottom" align="end" className="min-w-[140px]">
                          <DropdownMenuItem
                            onClick={() =>
                              openRenameDialog(conv.id, conv.title)
                            }
                          >
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

      {/* ── Footer ── */}
      <SidebarFooter className="px-2 pb-3 pt-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="h-8 px-2 rounded-lg">
                  <Avatar className="size-5 rounded-md">
                    {session?.user?.image && (
                      <AvatarImage
                        src={session.user.image}
                        alt={userName}
                        className="rounded-md"
                      />
                    )}
                    <AvatarFallback className="bg-indigo-500 text-white text-[10px] rounded-md">
                      {firstName[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm">{workspaceName}</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-[calc(var(--sidebar-width)-1rem)] min-w-0 rounded-lg text-[13px]">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal truncate px-3 py-1.5">
                  {userEmail}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={openEditWorkspace} className="px-3 py-1.5">
                  <PencilSimple className="size-3.5 mr-2 shrink-0" />
                  Rename workspace
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="px-3 py-1.5">
                  <Link href="/settings/integrations">
                    <PlugsConnected className="size-3.5 mr-2 shrink-0" />
                    Integrations
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="px-3 py-1.5">
                  <SignOut className="size-3.5 mr-2 shrink-0" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />

      {/* ── Rename workspace dialog ── */}
      <Dialog open={editWorkspaceOpen} onOpenChange={setEditWorkspaceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename workspace</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editingWorkspaceName}
              onChange={(e) => setEditingWorkspaceName(e.target.value)}
              placeholder="Workspace name"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveWorkspaceName();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditWorkspaceOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveWorkspaceName}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Rename conversation dialog ── */}
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
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmRename();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingConv(null)}>
              Cancel
            </Button>
            <Button onClick={confirmRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete conversation dialog ── */}
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
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Search dialog ── */}
      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelect={handleSearchSelect}
      />
    </Sidebar>
  );
}
