import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic'

const CLOSE_POPUP_HTML = (email: string, origin: string) => `<!DOCTYPE html>
<html><body><script>
  window.opener?.postMessage(
    { type: "GOOGLE_DRIVE_CONNECTED", email: ${JSON.stringify(email)} },
    ${JSON.stringify(origin)}
  );
  window.close();
</script></body></html>`;

const ERROR_HTML = (message: string) => `<!DOCTYPE html>
<html><body>
  <p style="font-family:sans-serif;padding:20px;color:#ef4444">${message}</p>
  <button onclick="window.close()" style="margin-top:12px;padding:8px 16px;cursor:pointer">Close</button>
</body></html>`;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const origin = `${url.protocol}//${url.host}`;

  if (errorParam) {
    return new Response(ERROR_HTML("Google connection cancelled."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  // CSRF check
  const cookieStore = await cookies();
  const savedState = cookieStore.get("google_oauth_state")?.value;
  if (!state || !savedState || state !== savedState) {
    return new Response(ERROR_HTML("Security error (invalid state)."), {
      headers: { "Content-Type": "text/html" },
    });
  }
  cookieStore.delete("google_oauth_state");

  if (!code) {
    return new Response(ERROR_HTML("Missing authorization code."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  // Auth check
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response(ERROR_HTML("Session expired. Please sign in again."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.workspaceId) {
    return new Response(ERROR_HTML("Workspace not found."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-drive/callback`,
      code,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!tokens.access_token) {
    return new Response(ERROR_HTML(`Token exchange failed: ${tokens.error ?? "unknown error"}`), {
      headers: { "Content-Type": "text/html" },
    });
  }

  // Fetch Google account email
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json() as { email?: string };
  const email = profile.email ?? session.user.email ?? "unknown";

  // Upsert integration
  await prisma.integration.upsert({
    where: { workspaceId_type: { workspaceId: user.workspaceId, type: "google-docs" } },
    create: {
      workspaceId: user.workspaceId,
      type: "google-docs",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null,
      accountEmail: email,
      status: "ACTIVE",
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : undefined,
      accountEmail: email,
      status: "ACTIVE",
    },
  });

  return new Response(CLOSE_POPUP_HTML(email, origin), {
    headers: { "Content-Type": "text/html" },
  });
}
