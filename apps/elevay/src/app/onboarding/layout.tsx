import { requireAuth } from "@/lib/auth-utils";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();
  return <>{children}</>;
}
