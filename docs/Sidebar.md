# Sidebar.md — LeadSens Left Sidebar Specification

> **Last updated:** February 2026
> **Purpose:** Complete reference for the simplified left sidebar with hover-to-reveal behavior.

---

## 1. Overview

The sidebar is a minimal, hover-to-reveal navigation panel pinned to the left edge of the screen. It contains only two elements:

1. **User dropdown** (top left) — existing workspace/user menu
2. **LeadSens button** — single main navigation entry (page principale + Company DNA)

Everything else from the current sidebar is removed: Home, My Team, Chat, Missions, Approvals, Recent Agents, Connections, Upgrade button.

---

## 2. Behavior — Hover-to-Reveal

### How it works

The sidebar is **collapsed by default** (`defaultOpen={false}` in the dashboard layout). When collapsed, a thin invisible edge trigger (4px) sits flush against the left edge of the viewport.

| State | Trigger | Result |
|-------|---------|--------|
| **Collapsed** | Mouse enters left 4px edge zone | Zone widens to 6px, shows `CaretRight` icon, sidebar opens after 150ms delay |
| **Expanded** | Mouse leaves sidebar area | Sidebar remains open (user must click rail or press `Cmd/Ctrl+B` to close) |
| **Expanded** | Click `SidebarRail` | Sidebar collapses |
| **Expanded** | `Cmd/Ctrl+B` keyboard shortcut | Sidebar collapses |
| **Expanded** | Drag left > 50px on rail | Sidebar collapses |
| **Mobile** | Hamburger / edge swipe | Opens as Sheet (drawer) overlay |

### Existing components (no changes needed)

- [sidebar-edge-trigger.tsx](apps/web/src/components/sidebar-edge-trigger.tsx) — 4px hover zone, 150ms delay, `CaretRight` indicator
- [sidebar.tsx](apps/web/src/components/ui/sidebar.tsx) — shadcn/ui primitives, `SidebarRail` drag-to-close, cookie persistence, `Cmd+B` shortcut

---

## 3. Component Structure

```
Sidebar (collapsible="offcanvas")
├── SidebarHeader
│   └── User Dropdown (avatar + "FirstName's Workspace")
│       ├── User info (name, email, plan tier)
│       ├── Workspace selector (current + new)
│       ├── Invite members
│       ├── Settings → /settings
│       ├── Refer & Earn
│       ├── Send Feedback
│       └── Logout
│
├── SidebarContent
│   └── SidebarGroup (no label)
│       └── SidebarMenu
│           └── LeadSens button → /home (or /leadsens)
│
├── SidebarFooter (empty — no Upgrade button)
└── SidebarRail (collapse handle)
```

---

## 4. LeadSens Button

### Purpose

Single entry point for the main application page. This page centralizes everything related to **Company DNA** — the agent building this page knows what to put in it (company info, ICP, tone, knowledge base, etc.).

### Rendering

```tsx
<SidebarMenuItem>
  <SidebarMenuButton
    tooltip="LeadSens"
    isActive={pathname === "/" || pathname === "/home" || pathname.startsWith("/leadsens")}
    asChild
    className="gap-x-3 h-9 px-3 rounded-lg"
  >
    <Link href="/home" prefetch>
      <Crosshair className="size-4" />
      <span>LeadSens</span>
    </Link>
  </SidebarMenuButton>
</SidebarMenuItem>
```

### Icon

Use `Crosshair` from `@phosphor-icons/react` (targeting/leads connotation). Alternatives: `Target`, `MagnifyingGlass`, `Radar`.

### Active state

Highlighted when pathname matches `/home`, `/`, or `/leadsens*`.

---

## 5. What to Remove

| Current item | Action |
|-------------|--------|
| Home (`/home`) | **Replaced** by LeadSens button |
| My Team (`/store`) | **Remove** |
| Chat (`/chat`) | **Remove** |
| Missions (`/missions`) | **Remove** |
| Approvals (`/approvals`) | **Remove** (including `ApprovalsMenuItem` component) |
| Recent Agents section | **Remove** (including `RecentAgents` + `RecentAgentsSkeleton` components) |
| Workspace separator | **Remove** |
| Company DNA (`/dna`) | **Remove** from sidebar — content moves into the LeadSens main page |
| Connections (`/connections`) | **Remove** |
| Upgrade to Pro button | **Remove** |

### What to Keep

| Current item | Notes |
|-------------|-------|
| User dropdown (SidebarHeader) | Keep exactly as-is: avatar, workspace name, dropdown with settings/invite/logout |
| `SidebarRail` | Keep — collapse handle |
| `SidebarEdgeTrigger` | Keep — hover-to-reveal |
| Dialogs (Invite, New Workspace, Edit Workspace) | Keep — accessed via user dropdown |
| Toggle button (`SidebarSimple` icon) | Keep — next to user avatar |

---

## 6. Styling

### Sidebar dimensions (CSS variables, unchanged)

```css
--sidebar-width: 14rem;           /* 224px */
--sidebar-width-mobile: 18rem;    /* 288px */
--sidebar-width-icon: 3rem;       /* 48px (icon-only mode, not used) */
```

### Color tokens (from globals.css, unchanged)

```css
/* Light */
--sidebar: oklch(0.98 0.01 250);
--sidebar-foreground: oklch(0.25 0.02 250);
--sidebar-accent: oklch(0.94 0.03 270);
--sidebar-accent-foreground: oklch(0.3 0.02 250);
--sidebar-border: oklch(0.93 0.01 250);
--sidebar-ring: oklch(0.55 0.22 270);

/* Dark */
--sidebar: oklch(0.16 0.02 260);
--sidebar-foreground: oklch(0.92 0.01 250);
--sidebar-accent: oklch(0.28 0.04 270);
--sidebar-accent-foreground: oklch(0.88 0.03 270);
--sidebar-border: oklch(0.3 0.02 260);
--sidebar-ring: oklch(0.65 0.2 270);
```

### Transitions (unchanged)

- Sidebar expand/collapse: `transition-[width] duration-200 ease-linear`
- Edge trigger hover: `transition-all duration-200`
- Button hover: `hover:bg-sidebar-accent hover:text-sidebar-accent-foreground`
- Active state: `data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium`

---

## 7. Simplified Component Code

### Target `app-sidebar.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import {
  Check,
  Gift,
  SignOut,
  ChatText,
  SidebarSimple,
  Plus,
  Gear,
  UserPlus,
  PencilSimple,
  Crosshair,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient, useSession } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InviteMembersDialog } from "@/components/invite-members-dialog";
import { NewWorkspaceDialog } from "@/components/new-workspace-dialog";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const AppSidebar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { toggleSidebar } = useSidebar();

  // Modal states
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);
  const [editWorkspaceOpen, setEditWorkspaceOpen] = useState(false);

  // Workspace name state
  const [workspaceName, setWorkspaceName] = useState("Workspace");
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

  return (
    <Sidebar collapsible="offcanvas" className="overflow-hidden">
      {/* ── Header: User dropdown (unchanged) ── */}
      <SidebarHeader className="p-3">
        <div className="flex items-center justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:bg-accent rounded-lg p-1.5 -m-1 transition-colors outline-none">
                <Avatar className="size-7 rounded-lg">
                  {session?.user?.image && (
                    <AvatarImage src={session.user.image} alt={userName} className="rounded-lg" />
                  )}
                  <AvatarFallback className="bg-indigo-500 text-white text-xs rounded-lg">
                    {firstName[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-sm truncate max-w-[120px]">
                  {firstName}'s Workspace
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {/* User info, workspace list, actions, logout — same as current */}
              {/* ... (keep entire dropdown content identical) ... */}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" className="size-7" onClick={toggleSidebar}>
            <SidebarSimple className="size-4" />
          </Button>
        </div>
      </SidebarHeader>

      {/* ── Content: LeadSens only ── */}
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="LeadSens"
                  isActive={pathname === "/" || pathname === "/home" || pathname.startsWith("/leadsens")}
                  asChild
                  className="gap-x-3 h-9 px-3 rounded-lg"
                >
                  <Link href="/home" prefetch>
                    <Crosshair className="size-4" />
                    <span>LeadSens</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer: empty ── */}
      <SidebarFooter className="p-3" />

      <SidebarRail />

      {/* Dialogs */}
      <InviteMembersDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <NewWorkspaceDialog open={newWorkspaceOpen} onOpenChange={setNewWorkspaceOpen} />
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
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveWorkspaceName(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditWorkspaceOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveWorkspaceName}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
};
```

---

## 8. Company DNA — Where It Lives Now

Company DNA is **no longer a separate sidebar link** (`/dna`). Instead, the LeadSens main page (`/home` or `/leadsens`) should include a Company DNA section/tab/card where the agent surfaces all relevant company context:

- Company name, industry, size, markets
- ICP (Ideal Customer Profile)
- Brand voice / tone guidelines
- Knowledge base documents
- Key contacts and org structure
- Any other context the agent uses to personalize its behavior

The agent building the LeadSens page decides what to include based on the Company DNA data model.

---

## 9. Files to Modify

| File | Change |
|------|--------|
| [app-sidebar.tsx](apps/web/src/components/app-sidebar.tsx) | Strip to user dropdown + LeadSens button only |
| [sidebar-edge-trigger.tsx](apps/web/src/components/sidebar-edge-trigger.tsx) | No change |
| [sidebar.tsx](apps/web/src/components/ui/sidebar.tsx) | No change |
| [(dashboard)/layout.tsx](apps/web/src/app/(dashboard)/layout.tsx) | No change (`defaultOpen={false}` already set) |
| [globals.css](apps/web/src/app/globals.css) | No change |

---

## 10. Visual Reference

```
┌──────────────────────────────────────────────────────────────────┐
│ COLLAPSED STATE (default)                                        │
│                                                                  │
│ ┃  ← 4px invisible edge trigger                                 │
│ ┃     hover → widens to 6px, shows ▶, opens sidebar after 150ms │
│ ┃                                                                │
│                        [main content fills full width]           │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ EXPANDED STATE (after hover or Cmd+B)                            │
│                                                                  │
│ ┌─────────────┐                                                  │
│ │ 😀 Martin ▾ │ ≡  ← user dropdown + toggle                    │
│ ├─────────────┤                                                  │
│ │             │                                                  │
│ │ ⊕ LeadSens │  ← single nav button, active state highlighted  │
│ │             │                                                  │
│ │             │                                                  │
│ │             │                                                  │
│ │             │                                                  │
│ │             │                                                  │
│ ├─────────────┤                                                  │
│ │  (empty)    │  ← no footer / no upgrade button                │
│ └──────┃──────┘                                                  │
│        ┃ ← SidebarRail (click or drag-left to close)            │
│                        [main content]                            │
└──────────────────────────────────────────────────────────────────┘
```
