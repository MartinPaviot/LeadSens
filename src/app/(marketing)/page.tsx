import Link from "next/link";

const STEPS = [
  {
    num: "01",
    title: "Connect your tools",
    desc: "Link Instantly, Apollo, ZeroBounce, or any tool you already use. LeadSens works with your stack.",
  },
  {
    num: "02",
    title: "Describe your ideal customer",
    desc: "Tell LeadSens who you want to reach in plain language. It converts your description into precise filters.",
  },
  {
    num: "03",
    title: "Launch & monitor",
    desc: "LeadSens sources, scores, enriches, writes personalized emails, and pushes campaigns. You stay in control.",
  },
];

const FEATURES = [
  {
    title: "Natural Language ICP",
    desc: "Describe your target in plain English or French. LeadSens parses it into precise sourcing filters with 99.8% accuracy.",
  },
  {
    title: "Smart Lead Scoring",
    desc: "Three-dimensional scoring: fit, intent signals, and timing. Only the best leads make it to your campaigns.",
  },
  {
    title: "Deep Enrichment",
    desc: "Company websites, LinkedIn profiles, and Apollo data combined. Every lead comes with a full context dossier.",
  },
  {
    title: "Pro Email Sequences",
    desc: "6-step frameworks (PAS, Value-add, Social Proof, and more) with quality gates. Every email is reviewed before sending.",
  },
  {
    title: "A/B Testing Built-in",
    desc: "3 subject line variants per step, 5 proven patterns. Performance data feeds back into future campaigns.",
  },
  {
    title: "Reply Management",
    desc: "AI classifies replies, drafts responses, and routes interested leads to your CRM. Nothing falls through the cracks.",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "$49",
    period: "/month",
    desc: "For solo founders testing outbound",
    features: [
      "500 leads/month",
      "1 connected ESP",
      "ICP parsing + scoring",
      "Company enrichment",
      "Email drafting (6 steps)",
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
      "All integrations",
      "LinkedIn enrichment",
      "A/B subject testing",
      "Reply management",
      "CRM push (HubSpot)",
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
      "All Pro features",
      "Multi-ESP routing",
      "Advanced analytics",
      "Adaptive drafting",
      "Custom integrations",
      "Dedicated support",
    ],
    cta: "Get Started",
    highlight: false,
  },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-leadsens-mesh opacity-50" />
        <div className="relative mx-auto max-w-4xl px-6 pb-24 pt-20 text-center md:pb-32 md:pt-28">
          <div className="mb-6 inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
            AI-Powered B2B Prospecting
          </div>
          <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
            Your AI agent for{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              outbound sales
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Describe your ideal customer. LeadSens handles the rest &mdash;
            sourcing, scoring, enriching, and sending personalized email
            sequences at scale. Using your own tools.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Start for free
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center rounded-lg border border-border px-8 text-base font-medium transition-colors hover:bg-muted"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border/50 bg-muted/20 py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-4 text-center text-3xl font-bold tracking-tight md:text-4xl">
            How it works
          </h2>
          <p className="mx-auto mb-16 max-w-xl text-center text-muted-foreground">
            Three steps from zero to running campaigns. No spreadsheets, no
            manual enrichment, no copy-paste.
          </p>
          <div className="grid gap-10 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.num} className="relative">
                <div className="mb-4 text-4xl font-bold text-muted-foreground/30">
                  {step.num}
                </div>
                <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
                <p className="text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-4 text-center text-3xl font-bold tracking-tight md:text-4xl">
            Everything you need for outbound
          </h2>
          <p className="mx-auto mb-16 max-w-xl text-center text-muted-foreground">
            LeadSens orchestrates your existing tools into a seamless pipeline.
            No new platforms to learn.
          </p>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border/60 bg-card p-6 transition-shadow hover:shadow-md"
              >
                <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border/50 bg-muted/20 py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-4 text-center text-3xl font-bold tracking-tight md:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mx-auto mb-16 max-w-xl text-center text-muted-foreground">
            Start free, upgrade when you&apos;re ready. No hidden fees.
          </p>
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
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm"
                    >
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

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            Ready to automate your outbound?
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Join founders and sales teams who use LeadSens to send better cold
            emails, faster.
          </p>
          <Link
            href="/signup"
            className="inline-flex h-12 items-center rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Get started for free
          </Link>
        </div>
      </section>
    </>
  );
}
