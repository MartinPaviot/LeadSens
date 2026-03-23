import { auth } from "@/lib/auth";
import { detectBrandContext } from "@/lib/brand-detection";
import { z } from "zod";

export const maxDuration = 30; // 3 appels Composio en parallèle

const BodySchema = z.object({
  brand_url: z.string().url(),
  country:   z.string().min(2).max(10),
  language:  z.string().min(2).max(10),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(`Invalid input: ${parsed.error.message}`, { status: 400 });
  }

  const { brand_url, country, language } = parsed.data;

  try {
    const result = await detectBrandContext(brand_url, country, language);
    return Response.json(result);
  } catch {
    // Never happens — detectBrandContext never throws
    return Response.json({ suggested_sector: "", suggested_competitors: [] });
  }
}
