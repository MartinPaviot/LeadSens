import { prisma } from "@/lib/prisma";
import { Prisma } from "@leadsens/db";

export const dynamic = 'force-dynamic'

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not Found", { status: 404 });
  }

  const user = await prisma.user.findFirst({
    where: { workspaceId: { not: null } },
  });

  if (!user?.workspaceId) {
    return Response.json({ ok: false, error: "No user with workspace found" }, { status: 404 });
  }

  const settings: Record<string, unknown> = {
    language: "fr",
    primaryKeyword: "logiciel CRM PME",
    secondaryKeyword: "gestion relation client",
    competitors: [
      { name: "DataSphere", url: "datasphere.fr" },
      { name: "InnovateTech", url: "innovatetech.io" },
    ],
  };

  const workspace = await prisma.workspace.update({
    where: { id: user.workspaceId },
    data: {
      name: "TechVision",
      companyUrl: "techvision.io",
      country: "France",
      settings: settings as unknown as Prisma.InputJsonValue,
    },
  });

  return Response.json({ ok: true, workspace });
}
