"use client";

import { UserMessage as SharedUserMessage } from "@leadsens/ui";
import { useSession } from "@/lib/auth-client";

export function UserMessage() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "U";
  const initial = firstName[0]?.toUpperCase() ?? "U";

  return <SharedUserMessage userInitial={initial} />;
}
