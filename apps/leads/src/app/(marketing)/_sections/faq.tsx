/**
 * T2-02: FAQ section with accessible accordion.
 * Pure HTML details/summary — no JS needed, no extra deps.
 */
import { SectionWrapper } from "../_components/section-wrapper";

const FAQ_ITEMS = [
  {
    q: "How is this different from Instantly or Smartlead?",
    a: "Instantly and Smartlead are email sending platforms. LeadSens is the brain that sits on top: it handles lead sourcing, scoring, enrichment, email writing, A/B testing, and reply management — then uses your ESP to send. Think of it as the orchestrator, not another sending tool.",
  },
  {
    q: "Do I need to buy new tools?",
    a: "No. LeadSens works with whatever you already use — Instantly, Smartlead, Lemlist, HubSpot, Apollo. If you're missing a tool, LeadSens adapts the pipeline to what's available.",
  },
  {
    q: "Can I control what the AI sends?",
    a: "Yes. LeadSens has three modes: Full Auto (AI handles everything), Supervised (you review and approve before sending), and Manual (AI drafts, you edit and send). You pick the level per campaign.",
  },
  {
    q: "What does \"Bring Your Own Tools\" mean?",
    a: "You connect your existing accounts (ESP, CRM, enrichment) and LeadSens orchestrates them. Your data stays in your tools. We never lock you into a proprietary platform — if you leave, your tools still work.",
  },
  {
    q: "Is my data safe?",
    a: "All API keys and tokens are encrypted at rest. LeadSens reads and writes through your own API keys but doesn't store raw lead data beyond what the pipeline needs. Your accounts, your data.",
  },
  {
    q: "What languages are supported?",
    a: "LeadSens writes emails in English and French. The AI matches the language you use when describing your ideal customer.",
  },
];

export function Faq() {
  return (
    <SectionWrapper className="py-24 md:py-32 px-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-4 text-center text-3xl font-bold tracking-tight md:text-4xl">
          Frequently asked <span className="gradient-text">questions</span>
        </h2>
        <p className="mx-auto mb-12 max-w-xl text-center text-muted-foreground">
          Common questions about how LeadSens works.
        </p>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-border/60 bg-card"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4 text-sm font-semibold select-none [&::-webkit-details-marker]:hidden list-none">
                {item.q}
                <svg
                  className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </summary>
              <div className="px-6 pb-4 text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
