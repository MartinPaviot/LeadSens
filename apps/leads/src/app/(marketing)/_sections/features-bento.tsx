"use client";

import { SectionWrapper } from "../_components/section-wrapper";
import {
  VisualNlIcp,
  VisualScoring,
  VisualEmail,
  VisualReplyManagement,
} from "../_components/feature-visuals";

interface Feature {
  title: string;
  desc: string;
  /** Grid span: "large" = col-span-2, "small" = col-span-1 */
  size: "large" | "small";
  icon: React.ReactNode;
  gradient?: string;
  visual: React.ReactNode;
}

const FEATURES: Feature[] = [
  {
    title: "Natural Language ICP",
    desc: "Describe your ideal customer in plain English or French. LeadSens turns it into precise sourcing filters automatically.",
    size: "large",
    gradient: "from-[#17C3B2]/10 to-transparent",
    icon: (
      <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
    visual: <VisualNlIcp />,
  },
  {
    title: "3D Lead Scoring",
    desc: "Fit, intent, and timing — scored before enrichment. Saves ~40% on data costs by filtering low-fit leads early.",
    size: "small",
    icon: (
      <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
    visual: <VisualScoring />,
  },
  {
    title: "Pro Email Sequences",
    desc: "6-step sequences with quality gates. Each email connects a real insight about your prospect to how you can help — no generic templates.",
    size: "large",
    gradient: "from-[#2C6BED]/10 to-transparent",
    icon: (
      <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
    visual: <VisualEmail />,
  },
  {
    title: "Reply Management & A/B Testing",
    desc: "AI classifies replies, drafts responses, and routes interested leads to your CRM. Auto A/B testing finds your best subject lines — losers pause, winners scale.",
    size: "small",
    icon: (
      <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
    visual: <VisualReplyManagement />,
  },
];

export function FeaturesBento() {
  return (
    <SectionWrapper id="features" className="py-24 md:py-32 px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-4 text-center text-3xl font-bold tracking-tight md:text-4xl">
          Everything you need for <span className="gradient-text">outbound</span>
        </h2>
        <p className="mx-auto mb-14 max-w-xl text-center text-muted-foreground">
          LeadSens orchestrates your existing tools into a seamless pipeline. No
          new platforms to learn.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`group relative rounded-2xl border border-border/60 bg-card p-6 card-hover overflow-hidden ${
                f.size === "large" ? "sm:col-span-2 lg:col-span-2" : ""
              }`}
              style={{
                animationDelay: `${i * 80}ms`,
              }}
            >
              {f.gradient && (
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />
              )}
              <div className="relative">
                <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-2.5 text-primary">
                  {f.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
                {/* Visual demo */}
                {f.visual}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
