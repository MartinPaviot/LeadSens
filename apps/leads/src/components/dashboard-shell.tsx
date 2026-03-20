"use client";

import { Suspense, type ReactNode } from "react";
import { ConversationProvider } from "@/components/conversation-provider";
import { AgentPanelProvider } from "@/components/agent-panel/agent-panel-context";
import { AgentPanel } from "@/components/agent-panel/agent-panel";
import { NavBar } from "@/components/layout/nav-bar";
import { OnboardingModal } from "@/components/onboarding/onboarding-modal";

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <ConversationProvider>
      <Suspense>
        <AgentPanelProvider>
          <div className="flex flex-col h-dvh">
            <NavBar />
            <main className="flex-1 min-h-0 overflow-y-auto pb-14 md:pb-0">
              {children}
            </main>
          </div>
          <AgentPanel />
          <OnboardingModal />
        </AgentPanelProvider>
      </Suspense>
    </ConversationProvider>
  );
}
