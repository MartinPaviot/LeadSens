import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-utils";
import { TRPCProvider } from "@/components/trpc-provider";
import { prisma } from "@/lib/prisma";

export default async function SeoDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  // Check if onboarding is complete (brand profile exists)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { workspaceId: true },
  });
  if (user?.workspaceId) {
    const profile = await prisma.elevayBrandProfile.findUnique({
      where: { workspaceId: user.workspaceId },
      select: { id: true },
    });
    if (!profile) {
      redirect("/onboarding");
    }
  }

  return (
    <TRPCProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        {children}
      </div>
    </TRPCProvider>
  );
}
