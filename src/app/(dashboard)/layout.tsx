import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth-utils";
import { TRPCProvider } from "@/components/trpc-provider";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

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
