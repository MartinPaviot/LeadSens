/**
 * T2-01: Testimonials credibility redesign.
 * 2 testimonials (more credible when pre-launch), colored accents, metric highlights.
 */
import { SectionWrapper } from "../_components/section-wrapper";

const TESTIMONIALS = [
  {
    quote:
      "We plugged in our Instantly account and described our ideal customer. Twenty minutes later, LeadSens had scored 800 leads and started drafting sequences. We stopped burning credits on low-fit contacts overnight.",
    name: "Sarah K.",
    role: "Head of Growth",
    company: "SaaS Startup (B2B)",
    metric: "80% less time",
    metricLabel: "on prospecting",
    initials: "SK",
    color: "#17C3B2",
  },
  {
    quote:
      "The emails actually reference what each company does — a hiring page, a blog post, a funding round. Prospects reply because it feels like someone researched them. That's what generic templates can never do.",
    name: "Marc D.",
    role: "Sales Director",
    company: "B2B Agency",
    metric: "3x reply rate",
    metricLabel: "in first month",
    initials: "MD",
    color: "#2C6BED",
  },
];

export function Testimonials() {
  return (
    <SectionWrapper className="section-alt py-24 md:py-32 px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-4 text-center text-3xl font-bold tracking-tight md:text-4xl">
          What early users <span className="gradient-text">say</span>
        </h2>
        <p className="mx-auto mb-14 max-w-xl text-center text-muted-foreground">
          Beta user feedback from teams testing LeadSens.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="relative rounded-2xl border border-border/60 bg-card p-6 card-hover overflow-hidden"
            >
              {/* Colored left accent border */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                style={{ backgroundColor: t.color }}
              />

              {/* Decorative quote mark */}
              <div
                className="absolute top-4 right-6 text-5xl font-serif leading-none opacity-[0.07]"
                style={{ color: t.color }}
              >
                &ldquo;
              </div>

              {/* Metric highlight */}
              <div className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  color: t.color,
                  backgroundColor: `${t.color}12`,
                }}
              >
                {t.metric}
                <span className="font-normal text-muted-foreground">{t.metricLabel}</span>
              </div>

              {/* Stars */}
              <div className="mb-3 flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    className="size-3.5 text-amber-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              <p className="mb-6 text-sm leading-relaxed text-foreground/80">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div
                  className="flex size-9 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: t.color }}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.role}, {t.company}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Beta disclaimer */}
        <p className="mt-6 text-center text-xs text-muted-foreground/50">
          Beta user feedback &middot; Results may vary
        </p>
      </div>
    </SectionWrapper>
  );
}
