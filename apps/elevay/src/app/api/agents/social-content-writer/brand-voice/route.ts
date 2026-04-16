import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@leadsens/db"
import { NextResponse } from "next/server"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const BrandVoiceSchema = z.object({
  style: z.string().min(1),
  register: z.string().min(1),
  forbiddenWords: z.array(z.string()).default([]),
  keyPhrases: z.array(z.string()).default([]),
  positioning: z.enum([
    "thought-leader",
    "brand-expert",
    "personal-brand",
    "corporate",
  ]),
  platformOverrides: z
    .record(
      z.string(),
      z.object({
        preferredLength: z.number().optional(),
        tone: z.string().optional(),
        hashtagCount: z.number().optional(),
        ctaType: z.string().optional(),
      }),
    )
    .optional(),
  examplePosts: z.array(z.string()).optional(),
})

async function resolveWorkspaceId(
  session: { user: { id: string; workspaceId?: string } },
): Promise<string | null> {
  if (session.user.workspaceId) return session.user.workspaceId
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { workspaceId: true },
  })
  return user?.workspaceId ?? null
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const workspaceId = await resolveWorkspaceId(
    session as { user: { id: string; workspaceId?: string } },
  )
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 })
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { settings: true },
  })
  const settings = (workspace?.settings as Record<string, unknown> | null) ?? {}
  const voiceConfig = settings.voiceConfig ?? null

  return NextResponse.json({ voiceConfig })
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const workspaceId = await resolveWorkspaceId(
    session as { user: { id: string; workspaceId?: string } },
  )
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 })
  }

  const parsed = BrandVoiceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { settings: true },
  })
  if (!workspace) {
    return NextResponse.json(
      { error: "NO_WORKSPACE" },
      { status: 400 },
    )
  }

  const existingSettings = (workspace.settings as Record<string, unknown> | null) ?? {}
  const updatedSettings = {
    ...existingSettings,
    voiceConfig: {
      ...parsed.data,
      calibratedAt: new Date().toISOString(),
    },
  }
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      settings: updatedSettings as unknown as Prisma.InputJsonValue,
    },
  })

  return NextResponse.json({ success: true })
}
