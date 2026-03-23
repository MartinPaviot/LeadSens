import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ComposioToolSet } from "composio-core";

const COMPOSIO_APP_NAME: Record<string, string> = {
  linkedin:    "linkedin",
  instagram:   "instagram",
  tiktok:      "tiktok",
  facebook:    "facebook",
  x:           "twitter",
  googledrive: "googledrive",
  googledocs:  "googledocs",
};

const VALID_PLATFORMS = Object.keys(COMPOSIO_APP_NAME);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { platform } = await params;
  if (!VALID_PLATFORMS.includes(platform)) {
    return new Response("Unknown platform", { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.workspaceId) {
    return new Response("No workspace", { status: 400 });
  }

  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    return new Response("COMPOSIO_API_KEY not set", { status: 500 });
  }

  const appName = COMPOSIO_APP_NAME[platform]!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/social/${platform}/callback`;

  const toolset = new ComposioToolSet({ apiKey, entityId: user.workspaceId });
  const connection = await toolset.connectedAccounts.initiate({
    appName,
    entityId: user.workspaceId,
    redirectUri,
  });

  return Response.json({ redirectUrl: connection.redirectUrl });
}
