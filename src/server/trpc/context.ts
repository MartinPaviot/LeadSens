import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createContext(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { workspace: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return {
    userId: user.id,
    workspaceId: user.workspaceId,
    workspace: user.workspace,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
