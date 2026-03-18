import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await prisma.workspace.findFirst({
    where: { users: { some: { id: session.user.id } } },
    select: { stripeCustomerId: true },
  });

  if (!workspace?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account found" }, { status: 404 });
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: workspace.stripeCustomerId,
    return_url: `${req.nextUrl.origin}/settings/integrations`,
  });

  return NextResponse.json({ url: portalSession.url });
}
