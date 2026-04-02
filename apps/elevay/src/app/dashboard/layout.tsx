import { requireAuth } from "@/lib/auth-utils";
import { TRPCProvider } from "@/components/trpc-provider";
import { DashboardShell } from "./dashboard-shell";

export default async function SeoDashboardLayout({
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
