import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const FAQSchema = z.object({
  question: z.string().min(1),
  keywords: z.array(z.string()).min(1),
  answer: z.string().min(1),
  platform: z.string().optional(),
})

async function resolveWorkspaceId(
  session: { user: { id: string } },
): Promise<string | null> {
  const wsId = (session.user as Record<string, unknown>)["workspaceId"] as
    | string
    | undefined
  if (wsId) return wsId
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

  const workspaceId = await resolveWorkspaceId(session)
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 })
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { settings: true },
  })

  const settings = (workspace?.settings as Record<string, unknown> | null) ?? {}
  const faqs = (settings["smiFaqs"] as unknown[]) ?? []

  return NextResponse.json({ faqs })
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const workspaceId = await resolveWorkspaceId(session)
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 })
  }

  const parsed = FAQSchema.safeParse(body)
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

  const settings = (workspace?.settings as Record<string, unknown> | null) ?? {}
  const existingFaqs = (settings["smiFaqs"] as Record<string, unknown>[]) ?? []

  const newFaq = {
    id: `faq_${Date.now()}`,
    ...parsed.data,
    hitCount: 0,
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      settings: {
        ...settings,
        smiFaqs: [...existingFaqs, newFaq],
      } as unknown as Prisma.InputJsonValue,
    },
  })

  return NextResponse.json({ faq: newFaq })
}
