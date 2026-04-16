import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ComposioToolSet } from "composio-core";

export const dynamic = 'force-dynamic'

const COMPOSIO_APP_NAME: Record<string, string> = {
  linkedin:    "linkedin",
  instagram:   "instagram",
  tiktok:      "tiktok",
  facebook:    "facebook",
  x:           "twitter",
  googledrive: "googledrive",
  googledocs:  "googledocs",
  gsc:         "google_search_console",
  ga:          "google_analytics",
  slack:       "slack",
  ahrefs:      "ahrefs",
  semrush:     "semrush",
};

/** Per-platform Composio Auth Config ID override */
const COMPOSIO_AUTH_CONFIG_ID: Record<string, string | undefined> = {
  linkedin: process.env.COMPOSIO_LINKEDIN_AUTH_CONFIG_ID,
  gsc:      process.env.COMPOSIO_GSC_AUTH_CONFIG_ID,
  ga:       process.env.COMPOSIO_GA_AUTH_CONFIG_ID,
  ahrefs:   process.env.COMPOSIO_AHREFS_AUTH_CONFIG_ID,
  semrush:  process.env.COMPOSIO_SEMRUSH_AUTH_CONFIG_ID,
  slack:    process.env.COMPOSIO_SLACK_AUTH_CONFIG_ID,
  shopify:  process.env.COMPOSIO_SHOPIFY_AUTH_CONFIG_ID,
  hubspot:  process.env.COMPOSIO_HUBSPOT_AUTH_CONFIG_ID,
};

const VALID_PLATFORMS = Object.keys(COMPOSIO_APP_NAME);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
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

    if (!process.env.COMPOSIO_API_KEY) {
      return Response.json({ redirectUrl: null, status: "pending", message: "Connection will be available soon" });
    }

    const appName = COMPOSIO_APP_NAME[platform]!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/social/${platform}/callback`;

    try {
      const toolset = new ComposioToolSet({ apiKey: process.env.COMPOSIO_API_KEY, entityId: user.workspaceId });
      const connection = await toolset.connectedAccounts.initiate({
        appName,
        entityId: user.workspaceId,
        redirectUri,
        ...(COMPOSIO_AUTH_CONFIG_ID[platform] && {
          authConfig: { authConfigId: COMPOSIO_AUTH_CONFIG_ID[platform] },
        }),
      });
      return Response.json({ redirectUrl: connection.redirectUrl }, {
        headers: { "Cross-Origin-Opener-Policy": "same-origin-allow-popups" },
      });
    } catch {
      // Graceful fallback: mark integration as pending
      try {
        const existing = await prisma.integration.findFirst({
          where: { workspaceId: user.workspaceId, type: platform },
        });
        if (existing) {
          await prisma.integration.update({
            where: { id: existing.id },
            data: { status: 'ERROR' },
          });
        } else {
          await prisma.integration.create({
            data: {
              workspaceId: user.workspaceId,
              type: platform,
              status: 'ERROR',
            },
          });
        }
      } catch {
        // best-effort
      }

      return Response.json({ redirectUrl: null, status: "error" });
    }
  } catch {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
