import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.workspaceId) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }
  const workspaceId = session.user.workspaceId

  const [bpiRun, mtsRun, ciaRun, profile] = await Promise.all([
    prisma.elevayAgentRun.findFirst({
      where: { workspaceId, agentCode: "BPI-01" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.elevayAgentRun.findFirst({
      where: { workspaceId, agentCode: "MTS-02" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.elevayAgentRun.findFirst({
      where: { workspaceId, agentCode: "CIA-03" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.elevayBrandProfile.findUnique({ where: { workspaceId } }),
  ])

  return Response.json({
    bpi: bpiRun?.output ?? null,
    mts: mtsRun?.output ?? null,
    cia: ciaRun?.output ?? null,
    profile,
    fetchedAt: new Date().toISOString(),
  })
}
