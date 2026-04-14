import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

// Helper: get workspaceId from session
async function getWorkspaceId(req?: Request): Promise<string | null> {
  const h = req ? req.headers : await headers()
  const session = await auth.api.getSession({ headers: h })
  if (!session?.user) return null
  let wid = (session.user as Record<string, unknown>).workspaceId as string | undefined
  if (!wid) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { workspaceId: true },
    })
    wid = user?.workspaceId ?? undefined
  }
  return wid ?? null
}

// GET /api/settings — load all settings data
export async function GET() {
  try {
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 })

    const [workspace, icps, members] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true, name: true, slug: true, companyUrl: true, industry: true,
          size: true, country: true, description: true, valueProp: true, logo: true,
          targetMarkets: true, timezone: true, dryRunMode: true, autonomyLevel: true,
          settings: true,
        },
      }),
      prisma.workspaceIcp.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.workspaceMember.findMany({
        where: { workspaceId },
        include: { user: { select: { id: true, email: true, name: true, image: true } } },
        orderBy: { invitedAt: "asc" },
      }),
    ])

    if (!workspace) return Response.json({ error: "NOT_FOUND" }, { status: 404 })

    // Usage stats (current month)
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const [aiEvents, chatSessions, agentRuns] = await Promise.all([
      prisma.aIEvent.aggregate({
        where: { workspaceId, createdAt: { gte: monthStart } },
        _sum: { cost: true, tokensIn: true, tokensOut: true },
        _count: true,
      }),
      prisma.conversation.count({
        where: { workspaceId, createdAt: { gte: monthStart } },
      }),
      prisma.elevayAgentRun.count({
        where: { workspaceId, createdAt: { gte: monthStart } },
      }),
    ])

    // Integrations
    const integrations = await prisma.integration.findMany({
      where: { workspaceId },
      select: { id: true, type: true, status: true, accountEmail: true, accountName: true, updatedAt: true },
    })

    return Response.json({
      workspace,
      icps,
      members,
      integrations,
      usage: {
        aiCost: aiEvents._sum.cost ?? 0,
        aiCalls: aiEvents._count,
        tokensIn: aiEvents._sum.tokensIn ?? 0,
        tokensOut: aiEvents._sum.tokensOut ?? 0,
        chatSessions,
        agentRuns,
      },
    })
  } catch (err) {
    console.error("[settings] GET error:", err)
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}

// PATCH /api/settings — update workspace fields
const companySchema = z.object({
  tab: z.literal("company"),
  name: z.string().min(1),
  companyUrl: z.string().url().optional().or(z.literal("")),
  industry: z.string().optional(),
  size: z.string().optional(),
  country: z.string().optional(),
  description: z.string().max(200).optional(),
  valueProp: z.string().optional(),
  logo: z.string().optional(),
  targetMarkets: z.array(z.string()).optional(),
})

const brandSchema = z.object({
  tab: z.literal("brand"),
  language: z.string().optional(),
  tone: z.string().optional(),
  emailSignature: z.string().optional(),
  neverMention: z.string().optional(),
  approvedExamples: z.string().optional(),
})

const competitiveSchema = z.object({
  tab: z.literal("competitive"),
  competitors: z.array(z.object({ name: z.string(), url: z.string() })).optional(),
  industryVerticals: z.array(z.string()).optional(),
  monitorKeywords: z.array(z.string()).optional(),
  excludedSectors: z.array(z.string()).optional(),
})

const agentsSchema = z.object({
  tab: z.literal("agents"),
  dryRunMode: z.boolean().optional(),
  timezone: z.string().optional(),
  reportSchedule: z.string().optional(),
  contentApprovalRequired: z.boolean().optional(),
})

const patchSchema = z.discriminatedUnion("tab", [companySchema, brandSchema, competitiveSchema, agentsSchema])

export async function PATCH(req: Request) {
  try {
    const workspaceId = await getWorkspaceId(req)
    if (!workspaceId) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 })

    const body: unknown = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data

    if (data.tab === "company") {
      const { tab: _, ...fields } = data
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: fields,
      })
    } else if (data.tab === "brand") {
      const { tab: _, ...fields } = data
      // Store brand settings in the JSON settings field
      const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { settings: true } })
      const current = (ws?.settings as Record<string, unknown>) ?? {}
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { settings: { ...current, ...fields } },
      })
    } else if (data.tab === "competitive") {
      const { tab: _, ...fields } = data
      const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { settings: true } })
      const current = (ws?.settings as Record<string, unknown>) ?? {}
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { settings: { ...current, ...fields } },
      })
    } else if (data.tab === "agents") {
      const { tab: _, dryRunMode, timezone, reportSchedule, contentApprovalRequired } = data
      const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { settings: true } })
      const current = (ws?.settings as Record<string, unknown>) ?? {}
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          ...(dryRunMode !== undefined && { dryRunMode }),
          ...(timezone !== undefined && { timezone }),
          settings: { ...current, reportSchedule, contentApprovalRequired },
        },
      })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error("[settings] PATCH error:", err)
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
