import { auth } from "@/lib/auth";
import { z } from "zod";

export const dynamic = 'force-dynamic'

// Keys are validated but never persisted server-side

const bodySchema = z.object({
  tool: z.enum(["upfluence", "klear", "kolsquare", "hypeauditor", "modash"]),
  apiKey: z.string().min(1),
});

const VALIDATION_ENDPOINTS: Record<string, { url: string; headerKey: string; headerPrefix: string }> = {
  upfluence: { url: "https://api.upfluence.com/v3/users/me", headerKey: "Authorization", headerPrefix: "Bearer " },
  klear: { url: "https://api.klear.com/api/v1/account", headerKey: "X-Api-Key", headerPrefix: "" },
  kolsquare: { url: "https://api.kolsquare.com/v1/me", headerKey: "Authorization", headerPrefix: "Bearer " },
  hypeauditor: { url: "https://hypeauditor.com/api/", headerKey: "api-token", headerPrefix: "" },
  modash: { url: "https://api.modash.io/v1/me", headerKey: "Authorization", headerPrefix: "Bearer " },
};

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ valid: false, error: "Invalid request" }, { status: 400 });
  }

  const { tool, apiKey } = parsed.data;
  const endpoint = VALIDATION_ENDPOINTS[tool];
  if (!endpoint) {
    return Response.json({ valid: false, error: "Unknown tool" }, { status: 400 });
  }

  try {
    const res = await fetch(endpoint.url, {
      method: "GET",
      headers: { [endpoint.headerKey]: `${endpoint.headerPrefix}${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok || res.status === 200) {
      return Response.json({ valid: true });
    }
    if (res.status === 401 || res.status === 403) {
      return Response.json({ valid: false, error: "Invalid API key" });
    }
    return Response.json({ valid: false, error: `${endpoint.url} returned ${res.status}` });
  } catch {
    return Response.json({ valid: false, error: `Could not reach ${tool} — check later` });
  }
}
