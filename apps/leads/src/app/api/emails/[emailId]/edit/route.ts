import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthError, ForbiddenError, NotFoundError, toErrorResponse } from "@/lib/errors";
import { captureStyleCorrection } from "@/server/lib/email/style-learner";

const editEmailSchema = z.object({
  body: z.string().optional(),
  approved: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ emailId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      throw new AuthError();
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user?.workspaceId) {
      throw new ForbiddenError("No workspace");
    }

    const { emailId } = await params;
    const raw = await req.json();
    const parsed = editEmailSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        { status: 400 },
      );
    }
    const { body, approved } = parsed.data;

    // Find the drafted email and verify ownership via lead.workspaceId
    const email = await prisma.draftedEmail.findUnique({
      where: { id: emailId },
      include: { lead: { select: { workspaceId: true } } },
    });

    if (!email || email.lead.workspaceId !== user.workspaceId) {
      throw new NotFoundError("Email", emailId);
    }

    const updateData: Record<string, unknown> = {};

    if (body !== undefined && body !== email.body) {
      updateData.userEdit = body;

      // Capture style correction for future drafting
      await captureStyleCorrection(
        user.workspaceId,
        email.body,
        body,
        "email",
      );
    }

    if (approved !== undefined) {
      updateData.approved = approved;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.draftedEmail.update({
        where: { id: emailId },
        data: updateData,
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
