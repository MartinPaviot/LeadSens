import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

export const dynamic = 'force-dynamic'

async function getWorkspaceId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  let wid = (session.user as Record<string, unknown>).workspaceId as string | undefined
  if (!wid) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { workspaceId: true } })
    wid = user?.workspaceId ?? undefined
  }
  return wid ?? null
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "viewer"]),
})

// POST — invite member
export async function POST(req: Request) {
  try {
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 })

    const body: unknown = await req.json()
    const parsed = inviteSchema.safeParse(body)
    if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 })

    // Find or create user by email
    let user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    if (!user) {
      user = await prisma.user.create({
        data: { email: parsed.data.email, name: parsed.data.email.split("@")[0] },
      })
    }

    // Check if already a member
    const existing = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    })
    if (existing) return Response.json({ error: "ALREADY_MEMBER" }, { status: 409 })

    const member = await prisma.workspaceMember.create({
      data: { workspaceId, userId: user.id, role: parsed.data.role },
      include: { user: { select: { id: true, email: true, name: true, image: true } } },
    })

    return Response.json(member)
  } catch (err) {
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}

// DELETE — remove member
export async function DELETE(req: Request) {
  try {
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get("id")
    if (!memberId) return Response.json({ error: "MISSING_ID" }, { status: 400 })

    const member = await prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId } })
    if (!member) return Response.json({ error: "NOT_FOUND" }, { status: 404 })
    if (member.role === "owner") return Response.json({ error: "CANNOT_REMOVE_OWNER" }, { status: 403 })

    await prisma.workspaceMember.delete({ where: { id: memberId } })
    return Response.json({ success: true })
  } catch (err) {
    void err;
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
