import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@leadsens/db"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const schema = z.object({
  brand_name: z.string().min(1),
  brand_url: z.string().url(),
  country: z.string().min(2),
  language: z.string().min(2),
  primary_keyword: z.string().min(1),
  secondary_keyword: z.string().min(1),
  sector: z.string().optional(),
  priority_channels: z.array(z.string()).default([]),
  objective: z.string().optional(),
  competitors: z
    .array(z.object({ name: z.string(), url: z.string() }))
    .default([]),
})

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return Response.json({ error: "UNAUTHORIZED" }, { status: 401 })
    }

    let workspaceId = (session.user as Record<string, unknown>).workspaceId as string | undefined
    if (!workspaceId) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { workspaceId: true },
      })
      workspaceId = user?.workspaceId ?? undefined
    }

    if (!workspaceId) {
      return Response.json({ error: "NO_WORKSPACE" }, { status: 400 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: "INVALID_JSON" }, { status: 400 })
    }

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const data = parsed.data

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    })
    const existingSettings = (workspace?.settings as Record<string, unknown> | null) ?? {}

    const newSettings = {
      ...existingSettings,
      language: data.language,
      primaryKeyword: data.primary_keyword,
      secondaryKeyword: data.secondary_keyword,
      competitors: data.competitors,
      priorityChannels: data.priority_channels,
      businessObjective: data.objective,
    }

    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        name: data.brand_name,
        companyUrl: data.brand_url,
        country: data.country,
        industry: data.sector,
        settings: newSettings as unknown as Prisma.InputJsonValue,
      },
    })

    return Response.json(updated)
  } catch {
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
