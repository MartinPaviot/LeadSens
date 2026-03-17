"use client";

import { SectionWrapper } from "../_components/section-wrapper";

const OLD_WAY = [
  "Manually search LinkedIn for leads",
  "Copy-paste into spreadsheets",
  "Enrich one by one on 3 different tools",
  "Write generic email templates",
  "Chase replies across 5 different tabs",
];

const NEW_WAY = [
  "Describe your ideal customer in plain language",
  "AI scores fit + intent + timing",
  "Deep enrichment: website, LinkedIn, hiring signals",
  "Personalized 6-step sequences per lead",
  "Auto-monitor, A/B test, and follow up",
];

export function ProblemSolution() {
  return (
    <SectionWrapper className="py-24 md:py-32 px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-4 text-center text-3xl font-bold tracking-tight md:text-4xl">
          Stop doing outbound <span className="gradient-text">the hard way</span>
        </h2>
        <p className="mx-auto mb-14 max-w-xl text-center text-muted-foreground">
          Most teams waste hours on manual tasks that an AI agent can do in minutes.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Old way */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-8">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-sm font-medium text-red-600 dark:text-red-400">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              The old way
            </div>
            <ul className="space-y-3">
              {OLD_WAY.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm text-muted-foreground"
                >
                  <span className="mt-1.5 size-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* New way */}
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-8 relative overflow-hidden">
            {/* Subtle glow */}
            <div className="absolute -top-20 -right-20 size-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                With LeadSens
              </div>
              <ul className="space-y-3">
                {NEW_WAY.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-sm text-foreground"
                  >
                    <svg
                      className="mt-0.5 size-4 shrink-0 text-emerald-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
