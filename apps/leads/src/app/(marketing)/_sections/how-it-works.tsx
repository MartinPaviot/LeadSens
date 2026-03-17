"use client";

import { useScrollReveal } from "../_hooks/use-scroll-reveal";

const STEPS = [
  {
    num: "01",
    title: "Connect your tools",
    desc: "Link Instantly, Apollo, HubSpot, or any tool you already use. LeadSens orchestrates your existing stack.",
    icon: (
      <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Describe your ideal customer",
    desc: "Tell LeadSens who you want to reach in plain language. The AI parses it into precise sourcing filters — no forms, no dropdowns.",
    icon: (
      <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "AI does the heavy lifting",
    desc: "Source, score, enrich, and write personalized 6-step email sequences. Quality gates ensure every email is ready.",
    icon: (
      <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
  },
  {
    num: "04",
    title: "Monitor & optimize",
    desc: "Real-time analytics, auto A/B testing, reply classification, and CRM routing. LeadSens learns and improves.",
    icon: (
      <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
];

export function HowItWorks() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section
      ref={ref}
      id="how-it-works"
      className="scroll-mt-20 border-t border-border/40 section-alt py-24 md:py-32 px-6"
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-4 text-center text-3xl font-bold tracking-tight md:text-4xl">
          Up and running in <span className="gradient-text">minutes</span>
        </h2>
        <p className="mx-auto mb-16 max-w-xl text-center text-muted-foreground">
          Four steps from zero to running campaigns. No spreadsheets, no manual
          enrichment, no copy-paste.
        </p>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-border/60 hidden md:block" />

          <div className="space-y-12 md:space-y-16">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className="relative md:pl-20"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible
                    ? "translateX(0)"
                    : "translateX(-20px)",
                  transition: `all 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 150}ms`,
                }}
              >
                {/* Step number circle */}
                <div className="hidden md:flex absolute left-0 size-12 items-center justify-center rounded-full border border-border/60 bg-background text-sm font-bold text-muted-foreground">
                  {step.num}
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-6 card-hover">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 rounded-lg bg-primary/10 p-2.5 text-primary">
                      {step.icon}
                    </div>
                    <div>
                      <div className="md:hidden text-xs font-bold text-muted-foreground/50 mb-1">
                        STEP {step.num}
                      </div>
                      <h3 className="mb-1.5 text-lg font-semibold">
                        {step.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
