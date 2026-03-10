import { describe, it, expect } from "vitest";
import { buildEmailPrompt, getFramework, prioritizeSignals } from "@/server/lib/email/prompt-builder";
import type { LeadForEmail } from "@/server/lib/email/types";
import type { EnrichmentData } from "@/server/lib/enrichment/summarizer";
import type { CompanyDna } from "@/server/lib/enrichment/company-analyzer";

// ─── Fixtures ────────────────────────────────────────────

const baseEnrichment: EnrichmentData = {
  companySummary: "AI-powered logistics platform for mid-market retailers",
  products: ["RouteOptimizer", "WarehouseAI"],
  targetMarket: "Mid-market retail chains (50-500 stores)",
  valueProposition: "40% reduction in last-mile delivery costs",
  painPoints: ["Rising shipping costs", "Manual route planning", "Late deliveries"],
  recentNews: ["Expanded to Southeast Asia"],
  techStack: ["AWS", "Kubernetes", "Python"],
  teamSize: "120",
  signals: [],
  hiringSignals: ["3 ML engineer openings"],
  fundingSignals: ["Series B $25M (2025-11)"],
  productLaunches: [],
  leadershipChanges: [{ event: "New CTO hired from Amazon Robotics", date: "2026-01-15", source: "LinkedIn" }],
  publicPriorities: [{ statement: "AI-first logistics by 2027", source: "CEO interview", date: "2026-02-01" }],
  techStackChanges: [{ change: "Migrating from GCP to AWS", date: "2025-12" }],
  linkedinHeadline: "VP Ops | Scaling logistics for next-gen retail",
  recentLinkedInPosts: ["Just spoke at LogiTech Summit about AI in supply chain"],
  careerHistory: ["VP Ops @ ShipFast (2023-now)", "Dir Logistics @ BigRetail (2019-2023)"],
  industry: "Logistics & Supply Chain",
  enrichmentContext: null,
  enrichmentLinkedin: null,
  enrichmentSignals: null,
  enrichmentDiagnostic: null,
};

const baseLead: LeadForEmail = {
  firstName: "Sarah",
  lastName: "Chen",
  jobTitle: "VP Operations",
  company: "ShipFast",
  industry: "Logistics & Supply Chain",
  companySize: "120",
  country: "United States",
  enrichmentData: baseEnrichment,
};

const minimalLead: LeadForEmail = {
  firstName: "John",
  jobTitle: "CEO",
  company: "Acme",
  industry: null,
  companySize: null,
  country: null,
  enrichmentData: null,
};

const companyDna: CompanyDna = {
  oneLiner: "We help logistics companies cut last-mile costs by 40%",
  problemsSolved: ["Rising shipping costs", "Inefficient route planning"],
  targetBuyers: [
    { role: "VP Operations", sellingAngle: "40% cost reduction on last-mile delivery" },
    { role: "Head of Logistics", sellingAngle: "AI-powered route optimization replacing manual planning" },
  ],
  pricingModel: "Per delivery volume",
  keyResults: ["Reduced delivery costs 42% for RetailCo in 90 days"],
  differentiators: ["AI-powered", "Real-time optimization"],
  objections: [
    { objection: "We already have route planning", response: "Our AI adapts in real-time to traffic and demand changes" },
  ],
  socialProof: [
    {
      industry: "Retail",
      clients: ["RetailCo", "ShopMax"],
      keyMetric: "42% cost reduction",
      testimonialQuote: "Game changer for our logistics",
    },
  ],
  caseStudies: [
    {
      client: "RetailCo",
      industry: "Retail",
      beforeState: "Manual route planning, 15% late deliveries",
      result: "42% cost reduction, 2% late deliveries",
      timeline: "90 days",
      context: "200 stores, 50 delivery vehicles",
      productUsed: "RouteOptimizer",
      quote: "Best investment we made this year",
    },
  ],
  ctas: [
    { label: "Book a 15-min demo", commitment: "medium", url: "https://example.com/demo" },
    { label: "See the benchmark report", commitment: "low", url: "https://example.com/report" },
  ],
  toneOfVoice: {
    register: "conversational",
    traits: ["data-driven", "concise"],
    avoidWords: ["synergy", "leverage"],
  },
  senderIdentity: { name: "Alex", role: "Head of Sales", signatureHook: "" },
  clientPortfolio: [
    { name: "RetailCo", industry: "Retail" },
    { name: "LogiPrime", industry: "Logistics" },
  ],
};

// ─── Tests ────────────────────────────────────────────────

describe("getFramework", () => {
  it("returns all 6 frameworks", () => {
    const names = [0, 1, 2, 3, 4, 5].map((s) => getFramework(s).name);
    expect(names).toEqual([
      "PAS (Timeline Hook)",
      "Value-add",
      "Social Proof",
      "New Angle",
      "Micro-value",
      "Breakup",
    ]);
  });

  it("has decreasing word limits for later steps", () => {
    const limits = [0, 1, 2, 3, 4, 5].map((s) => getFramework(s).maxWords);
    // Step 0 should be the longest, step 5 the shortest
    expect(limits[0]).toBeGreaterThan(limits[5]!);
  });

  it("defaults to step 0 for out-of-range", () => {
    expect(getFramework(99).name).toBe("PAS (Timeline Hook)");
  });
});

describe("prioritizeSignals", () => {
  it("sorts recent signals first", () => {
    const ed: EnrichmentData = {
      ...baseEnrichment,
      leadershipChanges: [{ event: "New CTO", date: "2026-02-01", source: null }],
      fundingSignals: ["Old round"],
    };
    const result = prioritizeSignals(ed);
    expect(result[0]!.type).toBe("leadership_change");
    expect(result[0]!.recency).toBe("recent");
  });

  it("uses custom weights when provided", () => {
    const ed: EnrichmentData = {
      ...baseEnrichment,
      leadershipChanges: [],
      hiringSignals: ["ML engineers"],
      fundingSignals: ["Series A"],
    };
    const weights = { hiring: 10, funding: 1 };
    const result = prioritizeSignals(ed, weights);
    // Hiring should come first with boosted weight
    const hiringIdx = result.findIndex((s) => s.type === "hiring");
    const fundingIdx = result.findIndex((s) => s.type === "funding");
    expect(hiringIdx).toBeLessThan(fundingIdx);
  });
});

describe("buildEmailPrompt", () => {
  describe("subject line patterns section", () => {
    it("includes all 5 pattern types", () => {
      const prompt = buildEmailPrompt({
        lead: baseLead,
        step: 0,
        companyDna,
      });
      expect(prompt).toContain("**Question**");
      expect(prompt).toContain("**Observation**");
      expect(prompt).toContain("**Curiosity gap**");
      expect(prompt).toContain("**Direct**");
      expect(prompt).toContain("**Personalized**");
    });

    it("has multiple examples per pattern (2-3 each)", () => {
      const prompt = buildEmailPrompt({
        lead: baseLead,
        step: 0,
        companyDna,
      });

      // Each pattern row should have the · separator for multiple examples
      const patternSection = prompt.split("SUBJECT LINE PATTERNS")[1]!;
      const rows = patternSection
        .split("\n")
        .filter((line) => line.includes("**") && line.includes("|"));

      for (const row of rows) {
        // Count examples by counting the · separator (N examples = N-1 separators)
        const exampleCount = (row.match(/·/g) ?? []).length + 1;
        expect(exampleCount).toBeGreaterThanOrEqual(2);
        expect(exampleCount).toBeLessThanOrEqual(3);
      }
    });

    it("instructs variants to use different patterns", () => {
      const prompt = buildEmailPrompt({
        lead: baseLead,
        step: 0,
        companyDna,
      });
      expect(prompt).toContain("MUST use a DIFFERENT pattern");
    });
  });

  describe("framework per step", () => {
    for (let step = 0; step <= 5; step++) {
      it(`step ${step} uses ${getFramework(step).name}`, () => {
        const prompt = buildEmailPrompt({
          lead: baseLead,
          step,
          companyDna,
        });
        expect(prompt).toContain(`Step ${step}: ${getFramework(step).name}`);
      });
    }
  });

  describe("prompt structure", () => {
    it("includes WHO YOU ARE section", () => {
      const prompt = buildEmailPrompt({ lead: baseLead, step: 0, companyDna });
      expect(prompt).toContain("WHO YOU ARE");
    });

    it("includes prospect data", () => {
      const prompt = buildEmailPrompt({ lead: baseLead, step: 0, companyDna });
      expect(prompt).toContain("Sarah");
      expect(prompt).toContain("VP Operations");
      expect(prompt).toContain("ShipFast");
    });

    it("includes connection bridge instruction", () => {
      const prompt = buildEmailPrompt({ lead: baseLead, step: 0, companyDna });
      expect(prompt).toContain("Connection Bridge");
      expect(prompt).toContain("SINGLE pain point");
    });

    it("includes enrichment data when available", () => {
      const prompt = buildEmailPrompt({ lead: baseLead, step: 0, companyDna });
      expect(prompt).toContain("Rising shipping costs");
      expect(prompt).toContain("RouteOptimizer");
      expect(prompt).toContain("BUYING SIGNALS");
    });

    it("handles minimal lead without enrichment", () => {
      const prompt = buildEmailPrompt({ lead: minimalLead, step: 0, companyDna });
      expect(prompt).toContain("John");
      expect(prompt).toContain("LIMITED PROSPECT DATA");
      expect(prompt).not.toContain("BUYING SIGNALS");
    });

    it("includes timeline hook for step 0 only", () => {
      const prompt0 = buildEmailPrompt({ lead: baseLead, step: 0, companyDna });
      const prompt1 = buildEmailPrompt({ lead: baseLead, step: 1, companyDna });
      expect(prompt0).toContain("TIMELINE HOOK (step 0 only)");
      expect(prompt1).not.toContain("TIMELINE HOOK (step 0 only)");
    });

    it("includes previous emails section for follow-ups", () => {
      const prompt = buildEmailPrompt({
        lead: baseLead,
        step: 1,
        companyDna,
        previousEmails: [{ step: 0, subject: "quick question", body: "Hey Sarah..." }],
      });
      expect(prompt).toContain("Previous emails");
      expect(prompt).toContain("quick question");
    });

    it("includes style section when provided", () => {
      const prompt = buildEmailPrompt({
        lead: baseLead,
        step: 0,
        companyDna,
        styleSamples: ["Keep it under 60 words"],
        winningPatterns: [{ summary: "Used leadership signal, 55 words", replyRate: 22.5 }],
      });
      expect(prompt).toContain("Style guide");
      expect(prompt).toContain("Keep it under 60 words");
      expect(prompt).toContain("22.5% reply rate");
    });

    it("includes step annotation when provided", () => {
      const prompt = buildEmailPrompt({
        lead: baseLead,
        step: 0,
        companyDna,
        stepAnnotation: { stepName: "PAS", replyRate: 14.2, sampleSize: 100, isTop: true },
      });
      expect(prompt).toContain("PERFORMANCE DATA");
      expect(prompt).toContain("14.2%");
      expect(prompt).toContain("best-performing");
    });

    it("ends with JSON output instruction", () => {
      const prompt = buildEmailPrompt({ lead: baseLead, step: 0, companyDna });
      expect(prompt).toContain('JSON uniquement');
      expect(prompt).toContain('"subject"');
      expect(prompt).toContain('"body"');
    });
  });

  describe("snapshot — subject line patterns section", () => {
    it("matches expected patterns table", () => {
      const prompt = buildEmailPrompt({ lead: baseLead, step: 0, companyDna });
      const startMarker = "## SUBJECT LINE PATTERNS";
      const endMarker = "## Constraints";
      const start = prompt.indexOf(startMarker);
      const end = prompt.indexOf(endMarker);
      const patternsSection = prompt.slice(start, end).trim();

      expect(patternsSection).toMatchInlineSnapshot(`
        "## SUBJECT LINE PATTERNS (pick the best fit for this step)
        | Pattern | Best for | Examples |
        |---------|----------|---------|
        | **Question** | Step 0, 4 — sparks curiosity | "quick question, {{firstName}}" · "thoughts on {{painPoint}}?" · "{{company}}'s approach to {{topic}}?" |
        | **Observation** | Step 0, 1 — shows research | "noticed your {{signal}}" · "saw {{company}} is {{action}}" · "{{number}} {{industry}} teams shifting" |
        | **Curiosity gap** | Step 1, 3 — teases insight | "idea for {{painPoint}}" · "{{number}}% of {{industry}} leaders..." · "what {{similarCompany}} changed" |
        | **Direct** | Step 2, 5 — cuts to the point | "{{solution}} for {{company}}" · "{{result}} in {{timeline}}" · "{{company}} + {{senderCompany}}" |
        | **Personalized** | Any step with strong signal | "re: {{specific_trigger}}" · "congrats on {{achievement}}" · "following {{event}}" |

        Include a concrete number when available (stat, %, count) — numbers in subjects boost open rates by +45%.
        Each variant in "subjects" MUST use a DIFFERENT pattern from this table. Never repeat the same pattern across variants."
      `);
    });
  });
});
