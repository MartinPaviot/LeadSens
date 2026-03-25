import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@leadsens/db";
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

/** Per-platform Composio Auth Config ID override */
const COMPOSIO_AUTH_CONFIG_ID: Record<string, string | undefined> = {
  linkedin: process.env.COMPOSIO_LINKEDIN_AUTH_CONFIG_ID,
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
      console.error("[social-connect] COMPOSIO_API_KEY missing");
      return Response.json({ redirectUrl: null, status: "pending", message: "Connection will be available soon" });
    }

    const appName = COMPOSIO_APP_NAME[platform]!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/social/${platform}/callback`;

    console.log("[social-connect] COMPOSIO_API_KEY:", process.env.COMPOSIO_API_KEY?.slice(0, 8) + "...");
    console.log("[social-connect] appName:", appName);
    console.log("[social-connect] entityId:", user.workspaceId);
    console.log("[social-connect] redirectUri:", redirectUri);

    if (platform === "linkedin") {
      console.log("[linkedin-connect] authConfigId:", process.env.COMPOSIO_LINKEDIN_AUTH_CONFIG_ID);
      console.log("[linkedin-connect] entityId:", session.user.id);
    }

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
      console.log("[social-connect] redirectUrl:", connection?.redirectUrl);
      return Response.json({ redirectUrl: connection.redirectUrl });
    } catch (composioErr) {
      if (platform === "linkedin") {
        console.error("[linkedin-connect] full error:", JSON.stringify(composioErr, null, 2));
      }
      console.error("[social-connect] Composio error:", composioErr instanceof Error
        ? { message: composioErr.message, name: composioErr.name, stack: composioErr.stack?.split("\n")[0] }
        : composioErr);

      // Graceful fallback: store "pending" in DB (merge with existing connections)
      try {
        const profile = await prisma.elevayBrandProfile.findUnique({
          where: { workspaceId: user.workspaceId },
          select: { social_connections: true },
        });
        const existing = (profile?.social_connections as Record<string, unknown>) ?? {};
        await prisma.elevayBrandProfile.updateMany({
          where: { workspaceId: user.workspaceId },
          data: {
            social_connections: { ...existing, [platform]: "pending" } as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (dbErr) {
        console.error("[social-connect] DB update error:", dbErr);
      }

      return Response.json({ redirectUrl: null, status: "error" });
    }
  } catch (err) {
    console.error("[social-connect] fatal error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
