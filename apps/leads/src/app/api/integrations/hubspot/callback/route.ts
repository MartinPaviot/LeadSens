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
    return new Response(
      `<!DOCTYPE html><html><body>
       <p style="font-family:sans-serif;text-align:center;margin-top:40vh;color:#dc2626">Missing OAuth code. This window will close&hellip;</p>
       <script>setTimeout(function(){window.close()},2000)</script>
       </body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }

  const { code } = parsed.data;

  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response(
      `<!DOCTYPE html><html><body>
       <p style="font-family:sans-serif;text-align:center;margin-top:40vh;color:#dc2626">HubSpot not configured. This window will close&hellip;</p>
       <script>setTimeout(function(){window.close()},2000)</script>
       </body></html>`,
      { headers: { "Content-Type": "text/html" } },
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

    return new Response(
      `<!DOCTYPE html><html><body>
       <p style="font-family:sans-serif;text-align:center;margin-top:40vh">Connected! This window will close&hellip;</p>
       <script>window.close()</script>
       </body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  } catch {
    return new Response(
      `<!DOCTYPE html><html><body>
       <p style="font-family:sans-serif;text-align:center;margin-top:40vh;color:#dc2626">Connection failed. This window will close&hellip;</p>
       <script>setTimeout(function(){window.close()},2000)</script>
       </body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }
}
