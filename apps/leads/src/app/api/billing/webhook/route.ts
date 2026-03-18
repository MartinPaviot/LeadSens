import { NextRequest, NextResponse } from "next/server";
import { stripe, getPlanByPriceId } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type Stripe from "stripe";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    logger.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    logger.error("[stripe-webhook] Signature verification failed:", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const workspaceId = session.metadata?.workspaceId;
        const planId = session.metadata?.planId;
        if (!workspaceId || !planId) break;

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (subscriptionId) {
          const subResponse = await stripe.subscriptions.retrieve(subscriptionId);
          // Stripe SDK v20+: response is the subscription object directly
          const subscription = subResponse as unknown as {
            items: { data: Array<{ price?: { id: string } }> };
            current_period_end: number;
          };
          const priceId = subscription.items.data[0]?.price?.id;

          await prisma.workspace.update({
            where: { id: workspaceId },
            data: {
              plan: planId,
              stripeSubscriptionId: subscriptionId,
              stripePriceId: priceId ?? null,
              billingPeriodEnd: new Date(subscription.current_period_end * 1000),
            },
          });

          logger.info("[stripe-webhook] Subscription created", {
            workspaceId,
            planId,
            subscriptionId,
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subUpdated = event.data.object as Stripe.Subscription & { current_period_end: number };
        const workspaceId = subUpdated.metadata?.workspaceId;
        if (!workspaceId) break;

        const priceId = subUpdated.items.data[0]?.price?.id;
        const plan = priceId ? getPlanByPriceId(priceId) : undefined;

        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            plan: plan?.id ?? "FREE",
            stripePriceId: priceId ?? null,
            billingPeriodEnd: new Date(subUpdated.current_period_end * 1000),
          },
        });

        logger.info("[stripe-webhook] Subscription updated", {
          workspaceId,
          status: subUpdated.status,
          plan: plan?.id,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const workspaceId = subscription.metadata?.workspaceId;
        if (!workspaceId) break;

        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            plan: "FREE",
            stripeSubscriptionId: null,
            stripePriceId: null,
            billingPeriodEnd: null,
          },
        });

        logger.info("[stripe-webhook] Subscription cancelled", { workspaceId });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        if (customerId) {
          logger.warn("[stripe-webhook] Payment failed", { customerId });
        }
        break;
      }
    }
  } catch (err) {
    logger.error("[stripe-webhook] Error handling event:", {
      type: event.type,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
