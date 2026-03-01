import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

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

  // Validate by calling Instantly API
  const res = await fetch("https://api.instantly.ai/api/v2/accounts", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    return Response.json(
      { error: "Invalid API key. Check your Instantly V2 API key." },
      { status: 400 },
    );
  }

  const accounts = await res.json();

  // Encrypt and store
  await prisma.integration.upsert({
    where: {
      workspaceId_type: { workspaceId: user.workspaceId, type: "INSTANTLY" },
    },
    create: {
      workspaceId: user.workspaceId,
      type: "INSTANTLY",
      apiKey: encrypt(apiKey),
      accountEmail: accounts?.[0]?.email,
      status: "ACTIVE",
    },
    update: {
      apiKey: encrypt(apiKey),
      accountEmail: accounts?.[0]?.email,
      status: "ACTIVE",
    },
  });

  return Response.json({ connected: true, accounts: accounts?.length ?? 0 });
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
    where: { workspaceId: user.workspaceId, type: "INSTANTLY" },
  });

  return Response.json({ disconnected: true });
}
