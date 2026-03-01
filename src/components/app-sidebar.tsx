"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Buildings,
  Check,
  SignOut,
  SidebarSimple,
  PencilSimple,
  NotePencil,
  DotsThree,
  Trash,
  ChatCircle,
  PlugsConnected,
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
  useConversations,
  type ConversationSummary,
} from "@/components/conversation-provider";
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
    "Aujourd'hui": [],
    Hier: [],
    "7 derniers jours": [],
    "30 derniers jours": [],
    "Plus ancien": [],
  };

  for (const conv of conversations) {
    const date = new Date(conv.updatedAt);
    if (date >= today) {
      groups["Aujourd'hui"].push(conv);
    } else if (date >= yesterday) {
      groups["Hier"].push(conv);
    } else if (date >= weekAgo) {
      groups["7 derniers jours"].push(conv);
    } else if (date >= monthAgo) {
      groups["30 derniers jours"].push(conv);
    } else {
      groups["Plus ancien"].push(conv);
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

  const handleNewChat = () => {
    startNewChat();
    router.push("/");
    if (isMobile) setOpenMobile(false);
  };

  const handleSelect = (id: string) => {
    selectConversation(id);
    router.push("/");
    if (isMobile) setOpenMobile(false);
  };

  const handleRename = async (id: string, currentTitle: string | null) => {
    const newTitle = window.prompt("Renommer la conversation", currentTitle || "");
    if (!newTitle || newTitle === currentTitle) return;
    try {
      await fetch("/api/trpc/conversation.rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title: newTitle }),
      });
      await refreshConversations();
    } catch {
      toast.error("Impossible de renommer");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Supprimer cette conversation ?")) return;
    try {
      await fetch("/api/trpc/conversation.delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await refreshConversations();
      if (activeId === id) startNewChat();
    } catch {
      toast.error("Impossible de supprimer");
    }
  };

  return (
    <Sidebar collapsible="offcanvas" className="overflow-hidden">
      {/* ── Header ── */}
      <SidebarHeader className="p-3">
        <div className="flex items-center justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:bg-accent rounded-lg p-1.5 -m-1 transition-colors outline-none">
                <Avatar className="size-7 rounded-lg">
                  {session?.user?.image && (
                    <AvatarImage
                      src={session.user.image}
                      alt={userName}
                      className="rounded-lg"
                    />
                  )}
                  <AvatarFallback className="bg-indigo-500 text-white text-xs rounded-lg">
                    {firstName[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-sm truncate max-w-[120px]">
                  {workspaceName}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{userName}</p>
                  <p className="text-xs text-muted-foreground">{userEmail}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                Workspace
              </DropdownMenuLabel>
              <DropdownMenuItem className="justify-between">
                <span className="truncate">{workspaceName}</span>
                <Check className="size-4 text-green-500 shrink-0" />
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openEditWorkspace}>
                <PencilSimple className="size-4 mr-2" />
                Renommer le workspace
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings/integrations">
                  <PlugsConnected className="size-4 mr-2" />
                  Integrations
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  router.push("/login");
                }}
              >
                <SignOut className="size-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={handleNewChat}
              title="Nouvelle conversation"
            >
              <NotePencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={toggleSidebar}
            >
              <SidebarSimple className="size-4" />
            </Button>
          </div>
        </div>
      </SidebarHeader>

      {/* ── Content: Conversation list ── */}
      <SidebarContent className="px-2">
        {groups.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <ChatCircle className="size-8 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              Aucune conversation
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <SidebarGroup key={group.label} className="py-1">
              <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/60 px-2">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.conversations.map((conv) => (
                    <SidebarMenuItem key={conv.id}>
                      <SidebarMenuButton
                        isActive={activeId === conv.id}
                        onClick={() => handleSelect(conv.id)}
                        className="h-8 px-2 rounded-lg"
                        title={conv.title || "Sans titre"}
                      >
                        <span className="truncate text-sm">
                          {conv.title || "Sans titre"}
                        </span>
                      </SidebarMenuButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuAction showOnHover>
                            <DotsThree className="size-4" weight="bold" />
                          </SidebarMenuAction>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start">
                          <DropdownMenuItem
                            onClick={() =>
                              handleRename(conv.id, conv.title)
                            }
                          >
                            <PencilSimple className="size-4 mr-2" />
                            Renommer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(conv.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash className="size-4 mr-2" />
                            Supprimer
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
      <SidebarFooter className="px-2 pb-3 pt-0">
        <div className="mx-1 border-t border-sidebar-border mb-1" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-8 px-2 rounded-lg text-muted-foreground"
            >
              <Link href="/settings/integrations">
                <PlugsConnected className="size-3.5" />
                <span className="text-sm">Integrations</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-8 px-2 rounded-lg text-muted-foreground"
            >
              <Link href="/company-dna">
                <Buildings className="size-3.5" />
                <span className="text-sm">Company DNA</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={async () => {
                await signOut();
                router.push("/login");
              }}
              className="h-8 px-2 rounded-lg text-muted-foreground"
            >
              <SignOut className="size-3.5" />
              <span className="text-sm">Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />

      {/* ── Rename workspace dialog ── */}
      <Dialog open={editWorkspaceOpen} onOpenChange={setEditWorkspaceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renommer le workspace</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editingWorkspaceName}
              onChange={(e) => setEditingWorkspaceName(e.target.value)}
              placeholder="Nom du workspace"
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
              Annuler
            </Button>
            <Button onClick={handleSaveWorkspaceName}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
