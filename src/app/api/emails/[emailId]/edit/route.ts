import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { captureStyleCorrection } from "@/server/lib/email/style-learner";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ emailId: string }> },
) {
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

  const { emailId } = await params;
  const { body, approved } = await req.json();

  // Find the drafted email and verify ownership via lead.workspaceId
  const email = await prisma.draftedEmail.findUnique({
    where: { id: emailId },
    include: { lead: { select: { workspaceId: true } } },
  });

  if (!email || email.lead.workspaceId !== user.workspaceId) {
    return Response.json({ error: "Email not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (typeof body === "string" && body !== email.body) {
    updateData.userEdit = body;

    // Capture style correction for future drafting
    await captureStyleCorrection(
      user.workspaceId,
      email.body,
      body,
      "email",
    );
  }

  if (typeof approved === "boolean") {
    updateData.approved = approved;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.draftedEmail.update({
      where: { id: emailId },
      data: updateData,
    });
  }

  return Response.json({ ok: true });
}
