/**
 * T2-05: Pricing teaser — 2-tier pricing preview.
 */
"use client";

import { SectionWrapper } from "../_components/section-wrapper";
import { GradientCta } from "../_components/gradient-cta";

const PLANS = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    description: "For solo founders getting started with outbound",
    features: [
      "100 leads / month",
      "1 ESP connected",
      "Basic enrichment",
      "6-step email sequences",
      "Manual approval mode",
    ],
    cta: "Start Free",
    href: "/signup",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/mo",
    description: "For teams who want full-auto outbound at scale",
    features: [
      "Unlimited leads",
      "Multi-ESP routing",
      "Full enrichment (LinkedIn + Website + Apollo)",
      "A/B testing with auto-optimization",
      "Reply management & CRM push",
      "Full auto & supervised modes",
    ],
    cta: "Get Early Access",
    href: "/signup?plan=pro",
    highlight: true,
  },
];

export function PricingTeaser() {
  return (
    <SectionWrapper className="py-24 md:py-32 px-6">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-4 text-center text-3xl font-bold tracking-tight md:text-4xl">
          Simple, <span className="gradient-text">transparent</span> pricing
        </h2>
        <p className="mx-auto mb-12 max-w-xl text-center text-muted-foreground">
          Start free, upgrade when you need more. No hidden fees, cancel anytime.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 card-hover ${
                plan.highlight
                  ? "border-primary/30 bg-gradient-to-b from-primary/[0.04] to-transparent"
                  : "border-border/60 bg-card"
              }`}
            >
              {/* Popular badge */}
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#17C3B2] via-[#2C6BED] to-[#FF7A3D] px-4 py-1 text-xs font-semibold text-white">
                  Most popular
                </div>
              )}

              <h3 className="mb-1 text-lg font-semibold">{plan.name}</h3>
              <p className="mb-4 text-sm text-muted-foreground">{plan.description}</p>

              <div className="mb-6">
                <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                {plan.period && (
                  <span className="text-muted-foreground">{plan.period}</span>
                )}
              </div>

              <ul className="mb-8 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <svg
                      className="mt-0.5 size-4 shrink-0 text-emerald-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-foreground/80">{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.highlight ? (
                <GradientCta href={plan.href} size="lg" className="btn-shine w-full justify-center">
                  {plan.cta}
                </GradientCta>
              ) : (
                <a
                  href={plan.href}
                  className="inline-flex h-13 w-full items-center justify-center rounded-full border-2 border-foreground/10 bg-foreground/[0.03] text-base font-medium transition-all hover:border-foreground/20 hover:bg-foreground/[0.06]"
                >
                  {plan.cta}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
