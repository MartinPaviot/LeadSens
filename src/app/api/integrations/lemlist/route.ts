import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { testLemlistConnection } from "@/server/lib/connectors/lemlist";

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

  const valid = await testLemlistConnection(apiKey);
  if (!valid) {
    return Response.json(
      { error: "Invalid API key. Check your Lemlist API key." },
      { status: 400 },
    );
  }

  await prisma.integration.upsert({
    where: {
      workspaceId_type: { workspaceId: user.workspaceId, type: "LEMLIST" },
    },
    create: {
      workspaceId: user.workspaceId,
      type: "LEMLIST",
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
    where: { workspaceId: user.workspaceId, type: "LEMLIST" },
  });

  return Response.json({ disconnected: true });
}
