import { auth } from "@/lib/auth";
import { getAuthUrl } from "@/server/lib/connectors/hubspot";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const clientId = process.env.HUBSPOT_CLIENT_ID;
  if (!clientId) {
    return Response.json(
      { error: "HubSpot OAuth not configured" },
      { status: 500 },
    );
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/integrations/hubspot/callback`;

  const url = getAuthUrl(clientId, redirectUri, [
    "crm.objects.contacts.read",
    "crm.objects.contacts.write",
  ]);

  return Response.redirect(url);
}
