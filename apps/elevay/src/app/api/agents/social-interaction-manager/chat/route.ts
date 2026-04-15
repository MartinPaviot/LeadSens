import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export const maxDuration = 60
export const dynamic = "force-dynamic"

/** Dashboard data for the Social Inbox. */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let workspaceId = (session.user as Record<string, unknown>).workspaceId as
    | string
    | undefined
  if (!workspaceId) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { workspaceId: true },
    })
    workspaceId = user?.workspaceId ?? undefined
  }
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 })
  }

  // Fetch recent interaction runs
  const recentRuns = await prisma.elevayAgentRun.findMany({
    where: { workspaceId, agentCode: "SMI-20" },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return NextResponse.json({
    interactions: recentRuns.map((r) => r.output),
    total: recentRuns.length,
    fetchedAt: new Date().toISOString(),
  })
}
