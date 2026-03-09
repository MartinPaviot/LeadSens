import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { testApolloConnection } from "@/server/lib/connectors/apollo";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user?.workspaceId) {
    return new Response("No workspace", { status: 403 });
  }

  const { apiKey } = await req.json();
  if (!apiKey || typeof apiKey !== "string") {
    return Response.json({ error: "API key required" }, { status: 400 });
  }

  // Validate by testing connection
  const valid = await testApolloConnection(apiKey);
  if (!valid) {
    return Response.json(
      { error: "Invalid API key. Check your Apollo API key." },
      { status: 400 },
    );
  }

  // Encrypt and store
  await prisma.integration.upsert({
    where: {
      workspaceId_type: { workspaceId: user.workspaceId, type: "APOLLO" },
    },
    create: {
      workspaceId: user.workspaceId,
      type: "APOLLO",
      apiKey: encrypt(apiKey),
      status: "ACTIVE",
    },
    update: {
      apiKey: encrypt(apiKey),
      status: "ACTIVE",
    },
  });

  return Response.json({ connected: true });
}

export async function DELETE(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user?.workspaceId) {
    return new Response("No workspace", { status: 403 });
  }

  await prisma.integration.deleteMany({
    where: { workspaceId: user.workspaceId, type: "APOLLO" },
  });

  return Response.json({ disconnected: true });
}
