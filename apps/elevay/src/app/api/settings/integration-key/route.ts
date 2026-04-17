import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const bodySchema = z.object({
  type: z.string().min(1),
  apiKey: z.string().min(1),
})

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.workspaceId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 })
  }

  const { type, apiKey } = parsed.data

  await prisma.integration.upsert({
    where: {
      workspaceId_type: {
        workspaceId: session.user.workspaceId,
        type,
      },
    },
    create: {
      workspaceId: session.user.workspaceId,
      type,
      apiKey,
      status: "ACTIVE",
    },
    update: {
      apiKey,
      status: "ACTIVE",
    },
  })

  return Response.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.workspaceId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { type } = (await req.json()) as { type?: string }
  if (!type) {
    return Response.json({ error: "Missing type" }, { status: 400 })
  }

  await prisma.integration.deleteMany({
    where: { workspaceId: session.user.workspaceId, type },
  })

  return Response.json({ success: true })
}
