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

const icpSchema = z.object({
  personaName: z.string().min(1),
  jobTitles: z.array(z.string()).default([]),
  targetIndustries: z.array(z.string()).default([]),
  companySizeMin: z.number().int().nullable().optional(),
  companySizeMax: z.number().int().nullable().optional(),
  targetGeos: z.array(z.string()).default([]),
  intentKeywords: z.array(z.string()).default([]),
  disqualificationCriteria: z.array(z.string()).default([]),
})

// POST — create ICP
export async function POST(req: Request) {
  try {
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 })

    const body: unknown = await req.json()
    const parsed = icpSchema.safeParse(body)
    if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 })

    const icp = await prisma.workspaceIcp.create({
      data: { workspaceId, ...parsed.data },
    })
    return Response.json(icp)
  } catch (err) {
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}

// PUT — update ICP
export async function PUT(req: Request) {
  try {
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 })

    const body = (await req.json()) as { id?: string }
    const { id, ...rest } = body
    if (!id) return Response.json({ error: "MISSING_ID" }, { status: 400 })

    const parsed = icpSchema.safeParse(rest)
    if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 })

    // Ensure ICP belongs to this workspace
    const existing = await prisma.workspaceIcp.findFirst({ where: { id, workspaceId } })
    if (!existing) return Response.json({ error: "NOT_FOUND" }, { status: 404 })

    const icp = await prisma.workspaceIcp.update({ where: { id }, data: parsed.data })
    return Response.json(icp)
  } catch (err) {
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}

// DELETE — delete ICP
export async function DELETE(req: Request) {
  try {
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) return Response.json({ error: "MISSING_ID" }, { status: 400 })

    const existing = await prisma.workspaceIcp.findFirst({ where: { id, workspaceId } })
    if (!existing) return Response.json({ error: "NOT_FOUND" }, { status: 404 })

    await prisma.workspaceIcp.delete({ where: { id } })
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
