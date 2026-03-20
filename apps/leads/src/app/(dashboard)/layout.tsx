import { requireAuth } from "@/lib/auth-utils";
import { TRPCProvider } from "@/components/trpc-provider";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  return (
    <TRPCProvider>
      <DashboardShell>{children}</DashboardShell>
    </TRPCProvider>
  );
}
