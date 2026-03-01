"use client";

import type { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarEdgeTrigger } from "@/components/sidebar-edge-trigger";
import { ConversationProvider } from "@/components/conversation-provider";

interface DashboardShellProps {
  children: ReactNode;
  defaultSidebarOpen: boolean;
}

export function DashboardShell({
  children,
  defaultSidebarOpen,
}: DashboardShellProps) {
  return (
    <ConversationProvider>
      <SidebarProvider defaultOpen={defaultSidebarOpen}>
        <AppSidebar />
        <SidebarEdgeTrigger />
        <main className="flex-1 min-w-0">{children}</main>
      </SidebarProvider>
    </ConversationProvider>
  );
}
