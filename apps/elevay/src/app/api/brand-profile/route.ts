import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

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

    // workspaceId may not be on session object — fallback to DB lookup
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

    const profile = await prisma.elevayBrandProfile.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        brand_name: data.brand_name,
        brand_url: data.brand_url,
        country: data.country,
        language: data.language,
        competitors: data.competitors,
        primary_keyword: data.primary_keyword,
        secondary_keyword: data.secondary_keyword,
        sector: data.sector,
        priority_channels: data.priority_channels,
        objective: data.objective,
      },
      update: {
        brand_name: data.brand_name,
        brand_url: data.brand_url,
        country: data.country,
        language: data.language,
        competitors: data.competitors,
        primary_keyword: data.primary_keyword,
        secondary_keyword: data.secondary_keyword,
        sector: data.sector,
        priority_channels: data.priority_channels,
        objective: data.objective,
      },
    })

    return Response.json(profile)
  } catch (err) {
    console.error("[brand-profile] Error:", err)
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
