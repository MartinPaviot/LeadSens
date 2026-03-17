import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { exchangeCode } from "@/server/lib/connectors/hubspot";

const oauthCallbackSchema = z.object({
  code: z.string().min(1, "OAuth code required"),
});

export async function GET(req: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return Response.redirect(`${appUrl}/login`);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user?.workspaceId) {
    return Response.redirect(`${appUrl}/login`);
  }

  const url = new URL(req.url);
  const parsed = oauthCallbackSchema.safeParse({
    code: url.searchParams.get("code") ?? "",
  });

  if (!parsed.success) {
    return Response.redirect(
      `${appUrl}/settings/integrations?error=no_code`,
    );
  }

  const { code } = parsed.data;

  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.redirect(
      `${appUrl}/settings/integrations?error=hubspot_not_configured`,
    );
  }

  const redirectUri = `${appUrl}/api/integrations/hubspot/callback`;

  try {
    const tokens = await exchangeCode(code, clientId, clientSecret, redirectUri);

    await prisma.integration.upsert({
      where: {
        workspaceId_type: { workspaceId: user.workspaceId, type: "HUBSPOT" },
      },
      create: {
        workspaceId: user.workspaceId,
        type: "HUBSPOT",
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        status: "ACTIVE",
      },
      update: {
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        status: "ACTIVE",
      },
    });

    return Response.redirect(`${appUrl}/?connected=hubspot`);
  } catch {
    return Response.redirect(`${appUrl}/?error=hubspot_failed`);
  }
}
