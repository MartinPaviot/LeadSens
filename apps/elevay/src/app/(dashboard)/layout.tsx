import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { TRPCProvider } from "@/components/trpc-provider";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  // Redirect to onboarding if workspace setup is incomplete
  if (session.user.workspaceId) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: session.user.workspaceId },
      select: { onboardingCompletedAt: true },
    });
    if (!workspace?.onboardingCompletedAt) {
      redirect("/onboarding");
    }
  }

  const cookieStore = await cookies();
  const sidebarState = cookieStore.get("sidebar_state")?.value;
  const defaultOpen = sidebarState === "true";

  return (
    <TRPCProvider>
      <DashboardShell defaultSidebarOpen={defaultOpen}>
        {children}
      </DashboardShell>
    </TRPCProvider>
  );
}
