"use client";

import type { ReactNode } from "react";
import { SidebarProvider } from "@leadsens/ui";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarEdgeTrigger } from "@leadsens/ui";
import { ConversationProvider } from "@/components/conversation-provider";
import { OnboardingModal } from "@/components/onboarding/onboarding-modal";

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
        <OnboardingModal />
      </SidebarProvider>
    </ConversationProvider>
  );
}
