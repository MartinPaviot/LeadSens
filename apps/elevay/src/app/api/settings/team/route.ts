import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { z } from "zod"

export const dynamic = 'force-dynamic'

async function getAuthContext(): Promise<{
  workspaceId: string
  userId: string
  role: string
} | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  const userId = session.user.id
  let wid = (session.user as Record<string, unknown>).workspaceId as string | undefined
  if (!wid) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { workspaceId: true } })
    wid = user?.workspaceId ?? undefined
  }
  if (!wid) return null

  // Fetch caller's role in this workspace
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: wid, userId } },
  })

  // If no membership record, check if user is the workspace creator (owner)
  const role = membership?.role ?? "owner"

  return { workspaceId: wid, userId, role }
}

function isAdmin(role: string): boolean {
  return role === "admin" || role === "owner"
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "viewer"]),
})

// POST — invite member (admin/owner only)
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 })

    if (!isAdmin(ctx.role)) {
      return Response.json({ error: "FORBIDDEN", message: "Admin role required to invite members" }, { status: 403 })
    }

    const body: unknown = await req.json()
    const parsed = inviteSchema.safeParse(body)
    if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 })

    let user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    if (!user) {
      user = await prisma.user.create({
        data: { email: parsed.data.email, name: parsed.data.email.split("@")[0] },
      })
    }

    const existing = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: ctx.workspaceId, userId: user.id } },
    })
    if (existing) return Response.json({ error: "ALREADY_MEMBER" }, { status: 409 })

    const member = await prisma.workspaceMember.create({
      data: { workspaceId: ctx.workspaceId, userId: user.id, role: parsed.data.role },
      include: { user: { select: { id: true, email: true, name: true, image: true } } },
    })

    logger.info({ action: "team.invite", actorId: ctx.userId, targetEmail: parsed.data.email, workspaceId: ctx.workspaceId, role: parsed.data.role }, "Team member invited")

    return Response.json(member)
  } catch (err) {
    void err
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}

// DELETE — remove member (admin/owner only)
export async function DELETE(req: Request) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 })

    if (!isAdmin(ctx.role)) {
      return Response.json({ error: "FORBIDDEN", message: "Admin role required to remove members" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get("id")
    if (!memberId) return Response.json({ error: "MISSING_ID" }, { status: 400 })

    const member = await prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId: ctx.workspaceId } })
    if (!member) return Response.json({ error: "NOT_FOUND" }, { status: 404 })
    if (member.role === "owner") return Response.json({ error: "CANNOT_REMOVE_OWNER" }, { status: 403 })

    await prisma.workspaceMember.delete({ where: { id: memberId } })

    logger.info({ action: "team.remove", actorId: ctx.userId, targetId: memberId, workspaceId: ctx.workspaceId }, "Team member removed")

    return Response.json({ success: true })
  } catch (err) {
    void err
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
