import { prisma } from "@/lib/prisma";

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

  const workspaceId = user.workspaceId;

  const profile = await prisma.elevayBrandProfile.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      brand_name: "TechVision",
      brand_url: "techvision.io",
      country: "France",
      language: "fr",
      competitors: [
        { name: "DataSphere", url: "datasphere.fr" },
        { name: "InnovateTech", url: "innovatetech.io" },
      ],
      primary_keyword: "logiciel CRM PME",
      secondary_keyword: "gestion relation client",
    },
    update: {},
  });

  return Response.json({ ok: true, profile });
}
