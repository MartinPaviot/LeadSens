import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, PLANS, type PlanId } from "@/lib/stripe";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { planId?: string };
  const planId = (body.planId ?? "PRO") as PlanId;
  const plan = PLANS[planId];

  if (!plan?.stripePriceId) {
    return NextResponse.json({ error: "Invalid plan or no price configured" }, { status: 400 });
  }

  // Get or create workspace
  const workspace = await prisma.workspace.findFirst({
    where: { users: { some: { id: session.user.id } } },
    select: { id: true, stripeCustomerId: true },
  });

  if (!workspace) {
    return NextResponse.json({ error: "No workspace found" }, { status: 404 });
  }

  // Get or create Stripe customer
  let customerId = workspace.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email,
      name: session.user.name ?? undefined,
      metadata: { workspaceId: workspace.id, userId: session.user.id },
    });
    customerId = customer.id;
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { stripeCustomerId: customerId },
    });
  }

  // Create checkout session
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${req.nextUrl.origin}/chat?billing=success`,
    cancel_url: `${req.nextUrl.origin}/pricing?billing=cancelled`,
    metadata: { workspaceId: workspace.id, planId },
    subscription_data: {
      metadata: { workspaceId: workspace.id, planId },
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
