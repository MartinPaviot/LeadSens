/**
 * T3-02: Metrics with context lines below each number.
 */
"use client";

import { useScrollReveal } from "../_hooks/use-scroll-reveal";
import { useCounter } from "../_hooks/use-counter";

interface Metric {
  value: number;
  suffix: string;
  label: string;
  context: string;
}

const METRICS: Metric[] = [
  { value: 2847, suffix: "", label: "Leads scored", context: "per campaign, automatically" },
  { value: 40, suffix: "%", label: "Enrichment savings", context: "by scoring before enriching" },
  { value: 312, suffix: "", label: "Emails quality-gated", context: "per batch, ready to send" },
];

export function Metrics() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section ref={ref} className="py-24 md:py-32 px-6">
      <div className="mx-auto max-w-4xl">
        <div className="grid gap-8 sm:grid-cols-3">
          {METRICS.map((metric, i) => (
            <MetricCard
              key={metric.label}
              metric={metric}
              enabled={isVisible}
              delay={i * 200}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  metric,
  enabled,
  delay,
}: {
  metric: Metric;
  enabled: boolean;
  delay: number;
}) {
  const value = useCounter({
    end: metric.value,
    duration: 2000,
    enabled,
  });

  return (
    <div
      className="text-center"
      style={{
        opacity: enabled ? 1 : 0,
        transform: enabled ? "translateY(0)" : "translateY(16px)",
        transition: `all 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      <div className="mb-2 text-5xl font-bold tracking-tight md:text-6xl">
        <span className="gradient-text">
          {value}
          {metric.suffix}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{metric.label}</p>
      <p className="mt-1 text-xs text-muted-foreground/50">{metric.context}</p>
    </div>
  );
}
