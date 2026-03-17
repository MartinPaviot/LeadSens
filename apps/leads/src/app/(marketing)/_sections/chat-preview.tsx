/**
 * T3-01: Pipeline visualization with animated connector line.
 */
"use client";

import { SectionWrapper } from "../_components/section-wrapper";
import { useScrollReveal } from "../_hooks/use-scroll-reveal";

const PIPELINE_STAGES = [
  {
    label: "Source",
    stat: "2,847",
    unit: "leads",
    color: "#17C3B2",
    icon: (
      <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
  },
  {
    label: "Score",
    stat: "1,204",
    unit: "qualified",
    color: "#2C6BED",
    icon: (
      <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
  {
    label: "Enrich",
    stat: "40%",
    unit: "saved",
    color: "#7C3AED",
    icon: (
      <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    label: "Draft",
    stat: "6",
    unit: "steps",
    color: "#F59E0B",
    icon: (
      <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    label: "Send",
    stat: "312",
    unit: "ready",
    color: "#10B981",
    icon: (
      <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
      </svg>
    ),
  },
];

export function ChatPreview() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <SectionWrapper className="section-alt border-t border-border/40 py-24 md:py-32 px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-4 text-center text-3xl font-bold tracking-tight md:text-4xl">
          From ideal customer to <span className="gradient-text">inbox</span>
        </h2>
        <p className="mx-auto mb-14 max-w-xl text-center text-muted-foreground">
          Every campaign flows through five stages. LeadSens handles each one
          so you focus on closing deals.
        </p>

        {/* Pipeline visualization */}
        <div ref={ref} className="relative">
          {/* Connector line background (desktop) */}
          <div className="absolute top-10 left-[10%] right-[10%] h-px bg-border/40 hidden md:block" />
          {/* Animated connector fill */}
          {isVisible && (
            <div className="absolute top-10 left-[10%] right-[10%] h-px hidden md:block overflow-hidden">
              <div
                className="h-full pipeline-connector-animated"
                style={{
                  background: "linear-gradient(90deg, #17C3B2, #2C6BED, #7C3AED, #F59E0B, #10B981)",
                }}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-5">
            {PIPELINE_STAGES.map((stage, i) => (
              <div
                key={stage.label}
                className="relative flex flex-col items-center text-center"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(20px)",
                  transition: `all 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 120}ms`,
                }}
              >
                {/* Icon circle */}
                <div
                  className="relative z-10 mb-3 flex size-20 items-center justify-center rounded-2xl border border-border/60 bg-card shadow-sm"
                  style={{
                    color: stage.color,
                    animation: isVisible ? `stage-pulse 0.4s ease ${0.3 + i * 0.3}s` : "none",
                  }}
                >
                  <div
                    className="absolute inset-0 rounded-2xl opacity-10"
                    style={{ backgroundColor: stage.color }}
                  />
                  <div className="relative">{stage.icon}</div>
                </div>

                {/* Label */}
                <p className="mb-1 text-sm font-semibold">{stage.label}</p>

                {/* Stat */}
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ color: stage.color }}
                >
                  {stage.stat}
                </p>
                <p className="text-xs text-muted-foreground">{stage.unit}</p>

                {/* Arrow (desktop, not on last) */}
                {i < PIPELINE_STAGES.length - 1 && (
                  <div className="absolute -right-3 top-10 hidden md:block text-border/60">
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
