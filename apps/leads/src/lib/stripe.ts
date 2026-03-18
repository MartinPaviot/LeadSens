import Stripe from "stripe";

/** Lazy-initialized Stripe client — only throws when actually used, not at import time */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is required");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { typescript: true });
  }
  return _stripe;
}

/** @deprecated Use getStripe() — this alias exists for backward compat */
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stripe SDK boundary
    return (getStripe() as any)[prop];
  },
});

// ─── Plan configuration ──────────────────────────────────

export type PlanId = "FREE" | "STARTER" | "PRO" | "SCALE";

export interface PlanConfig {
  id: PlanId;
  name: string;
  leadsPerMonth: number;
  /** Stripe Price ID — set via env vars, null for free tier */
  stripePriceId: string | null;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  FREE: {
    id: "FREE",
    name: "Free",
    leadsPerMonth: 50,
    stripePriceId: null,
  },
  STARTER: {
    id: "STARTER",
    name: "Starter",
    leadsPerMonth: 500,
    stripePriceId: process.env.STRIPE_PRICE_STARTER ?? null,
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    leadsPerMonth: 2000,
    stripePriceId: process.env.STRIPE_PRICE_PRO ?? null,
  },
  SCALE: {
    id: "SCALE",
    name: "Scale",
    leadsPerMonth: 999_999, // effectively unlimited
    stripePriceId: process.env.STRIPE_PRICE_SCALE ?? null,
  },
};

export function getPlanByPriceId(priceId: string): PlanConfig | undefined {
  return Object.values(PLANS).find((p) => p.stripePriceId === priceId);
}

export function getPlanConfig(planId: string): PlanConfig {
  return PLANS[planId as PlanId] ?? PLANS.FREE;
}
