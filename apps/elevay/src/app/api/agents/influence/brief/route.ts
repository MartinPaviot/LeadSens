import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ brief: null, error: "API key not configured" });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { influencer, brief, lang } = parsed.data;
  const isFrench = lang === 'fr' || brief.geography?.toLowerCase().includes('france');

  const userPrompt = `Generate a collaboration brief for ${influencer.name} (${influencer.handle}, ${influencer.followers.toLocaleString()} followers, ${influencer.engagementRate}% engagement, niche: ${influencer.niche}) for a ${brief.objective ?? 'branding'} campaign in ${brief.sector ?? 'general'}, targeting ${brief.geography ?? 'global'}, budget ${brief.budgetMin ?? '?'}–${brief.budgetMax ?? '?'}€. Platforms: ${(brief.platforms ?? influencer.platforms).join(', ')}. Write in ${isFrench ? 'French' : 'English'}. Max 120 words. Direct, no fluff.`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: "You are an expert influencer marketing strategist writing personalized outreach briefs in a professional but warm tone. Write only the brief text, no subject line or signature.",
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.7,
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return Response.json({ brief: text });
  } catch (err) {
    return Response.json({ brief: null, error: "Failed to generate brief" }, { status: 500 });
  }
}
