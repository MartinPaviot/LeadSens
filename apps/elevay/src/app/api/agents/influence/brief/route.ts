import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadWorkspaceContext } from "@/lib/agent-context";
import { toInfluenceBriefDefaults } from "@/lib/agent-adapters";
import { callLLM } from "@/agents/_shared/llm";
import { z } from "zod";

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  influencer: z.object({
    name: z.string(),
    handle: z.string(),
    followers: z.number(),
    engagementRate: z.number(),
    niche: z.string(),
    platforms: z.array(z.string()),
  }),
  brief: z.object({
    objective: z.string().optional(),
    sector: z.string().optional(),
    geography: z.string().optional(),
    budgetMin: z.number().optional(),
    budgetMax: z.number().optional(),
    platforms: z.array(z.string()).optional(),
  }),
  lang: z.enum(["fr", "en"]).optional(),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { influencer, brief: briefOverride, lang } = parsed.data;

  // Merge brief with Settings defaults (body takes precedence)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { workspaceId: true },
  });
  const defaults = user?.workspaceId
    ? toInfluenceBriefDefaults(await loadWorkspaceContext(user.workspaceId)).data
    : {};
  const brief: {
    objective?: string
    sector?: string
    geography?: string
    budgetMin?: number
    budgetMax?: number
    platforms?: string[]
  } = {
    sector: defaults.sector,
    geography: defaults.geography,
    budgetMin: defaults.budgetMin,
    budgetMax: defaults.budgetMax,
    platforms: defaults.platforms,
    ...Object.fromEntries(Object.entries(briefOverride).filter(([, v]) => v !== undefined)),
  };

  const effectiveLang = lang ?? defaults.language;
  const isFrench = effectiveLang === 'fr' || brief.geography?.toLowerCase().includes('france');

  const userPrompt = `Generate a collaboration brief for ${influencer.name} (${influencer.handle}, ${influencer.followers.toLocaleString()} followers, ${influencer.engagementRate}% engagement, niche: ${influencer.niche}) for a ${brief.objective ?? 'branding'} campaign in ${brief.sector ?? 'general'}, targeting ${brief.geography ?? 'global'}, budget ${brief.budgetMin ?? '?'}–${brief.budgetMax ?? '?'}€. Platforms: ${(brief.platforms ?? influencer.platforms).join(', ')}. Write in ${isFrench ? 'French' : 'English'}. Max 120 words. Direct, no fluff.`;

  const response = await callLLM(
    {
      system: "You are an expert influencer marketing strategist writing personalized outreach briefs in a professional but warm tone. Write only the brief text, no subject line or signature.",
      user: userPrompt,
      maxTokens: 512,
      temperature: 0.7,
    },
    { workspaceId: user?.workspaceId ?? "", agentCode: "CIO" },
  );

  if (!response.content) {
    return Response.json({ brief: null, error: "Failed to generate brief" }, { status: 500 });
  }

  return Response.json({ brief: response.content });
}
