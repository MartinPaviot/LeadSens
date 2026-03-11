import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing - LeadSens",
  description: "Simple, transparent pricing for AI-powered B2B prospecting",
};

const PLANS = [
  {
    name: "Starter",
    price: "$49",
    period: "/month",
    desc: "For solo founders testing outbound",
    features: [
      "500 leads/month",
      "1 connected ESP (Instantly)",
      "Natural language ICP parsing",
      "ICP scoring (fit + intent + timing)",
      "Company enrichment (5 pages)",
      "Email drafting (6-step sequences)",
      "Quality gate on every email",
      "Campaign push to Instantly",
      "Email support",
    ],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$99",
    period: "/month",
    desc: "For teams running consistent outbound",
    features: [
      "2,000 leads/month",
      "All integrations (Instantly, Apollo, ZeroBounce)",
      "LinkedIn enrichment (Apify)",
      "A/B subject line testing (3 variants)",
      "Reply classification + auto-drafting",
      "CRM push (HubSpot contact + deal)",
      "Campaign analytics + insights",
      "Adaptive drafting from performance data",
      "Bounce & reply guards",
      "Priority support",
    ],
    cta: "Get Started",
    highlight: true,
  },
  {
    name: "Scale",
    price: "$199",
    period: "/month",
    desc: "For agencies and power users",
    features: [
      "Unlimited leads",
      "Everything in Pro",
      "Multi-ESP routing (Smartlead, Lemlist)",
      "CSV import with field mapping",
      "Cross-campaign winning patterns",
      "Advanced variant attribution",
      "Custom webhook integrations",
      "Dedicated support + onboarding call",
    ],
    cta: "Get Started",
    highlight: false,
  },
];

const FAQS = [
  {
    q: "What tools do I need to bring?",
    a: "At minimum, you need an Instantly account for sending campaigns. Apollo (enrichment) and ZeroBounce (email verification) are optional but recommended for better results.",
  },
  {
    q: "How does billing work?",
    a: "You're billed monthly. Lead counts reset each month. You can upgrade, downgrade, or cancel anytime.",
  },
  {
    q: "What counts as a lead?",
    a: "A lead is counted when it's sourced into a campaign. Leads that are scored and filtered out still count toward your limit.",
  },
  {
    q: "Can I try before I buy?",
    a: "Yes. Sign up and run a small campaign (up to 20 leads) for free to see the quality before committing to a plan.",
  },
  {
    q: "Do you store my API keys securely?",
    a: "All API keys are encrypted with AES-256-GCM before storage. We never log or expose your credentials.",
  },
];

export default function PricingPage() {
  return (
    <>
      {/* Hero */}
      <section className="py-20 text-center md:py-28">
        <div className="mx-auto max-w-3xl px-6">
          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-muted-foreground">
            Start free, upgrade when you need more. No hidden fees, no long-term
            contracts.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-8 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-xl border p-8 ${
                  plan.highlight
                    ? "border-primary bg-card shadow-lg"
                    : "border-border/60 bg-card"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                    Most popular
                  </div>
                )}
                <h3 className="mb-1 text-xl font-bold">{plan.name}</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  {plan.desc}
                </p>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <svg
                        className="mt-0.5 size-4 shrink-0 text-primary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`inline-flex h-11 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                    plan.highlight
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-border bg-background hover:bg-muted"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border/50 bg-muted/20 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">
            Frequently asked questions
          </h2>
          <div className="space-y-8">
            {FAQS.map((faq) => (
              <div key={faq.q}>
                <h3 className="mb-2 font-semibold">{faq.q}</h3>
                <p className="text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
