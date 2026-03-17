import { describe, it, expect } from "vitest";
import {
  classifyEnrichmentDepth,
  buildDraftMetadata,
} from "@/server/lib/tools/email-tools";
import type { EnrichmentData } from "@/server/lib/enrichment/summarizer";

// ─── classifyEnrichmentDepth ──────────────────────────────

describe("classifyEnrichmentDepth", () => {
  it('returns "none" for null', () => {
    expect(classifyEnrichmentDepth(null)).toBe("none");
  });

  it('returns "none" for undefined', () => {
    expect(classifyEnrichmentDepth(undefined)).toBe("none");
  });

  it('returns "none" for empty object (no fields populated)', () => {
    const ed = {} as EnrichmentData;
    expect(classifyEnrichmentDepth(ed)).toBe("none");
  });

  it('returns "minimal" with 1 field populated', () => {
    const ed = { companySummary: "A SaaS company" } as EnrichmentData;
    expect(classifyEnrichmentDepth(ed)).toBe("minimal");
  });

  it('returns "minimal" with 2 fields populated', () => {
    const ed = {
      companySummary: "A SaaS company",
      painPoints: ["slow processes"],
    } as EnrichmentData;
    expect(classifyEnrichmentDepth(ed)).toBe("minimal");
  });

  it('returns "partial" with 3 fields populated', () => {
    const ed = {
      companySummary: "A SaaS company",
      painPoints: ["slow processes"],
      products: ["CRM"],
    } as EnrichmentData;
    expect(classifyEnrichmentDepth(ed)).toBe("partial");
  });

  it('returns "partial" with 4 fields populated', () => {
    const ed = {
      companySummary: "A SaaS company",
      painPoints: ["slow processes"],
      products: ["CRM"],
      techStack: ["React"],
    } as EnrichmentData;
    expect(classifyEnrichmentDepth(ed)).toBe("partial");
  });

  it('returns "rich" with 5+ fields populated', () => {
    const ed = {
      companySummary: "A SaaS company",
      painPoints: ["slow processes"],
      products: ["CRM"],
      techStack: ["React"],
      linkedinHeadline: "VP of Sales",
    } as EnrichmentData;
    expect(classifyEnrichmentDepth(ed)).toBe("rich");
  });

  it('returns "rich" with all fields populated', () => {
    const ed = {
      companySummary: "A SaaS company",
      painPoints: ["slow processes"],
      products: ["CRM"],
      techStack: ["React"],
      linkedinHeadline: "VP of Sales",
      recentLinkedInPosts: ["Post about AI"],
      careerHistory: ["Previous: CTO at X"],
      valueProposition: "Fastest CRM",
      targetMarket: "SMBs",
      hiringSignals: [{ detail: "Hiring SDR", date: null, source: null }],
    } as EnrichmentData;
    expect(classifyEnrichmentDepth(ed)).toBe("rich");
  });

  // ── Signal types: any of 4 signal arrays count as 1 field ──

  it("counts signals array as 1 field", () => {
    const ed = { signals: ["Signal A"] } as unknown as EnrichmentData;
    expect(classifyEnrichmentDepth(ed)).toBe("minimal");
  });

  it("counts hiringSignals as 1 field", () => {
    const ed = {
      hiringSignals: [{ detail: "Hiring SDR", date: null, source: null }],
    } as EnrichmentData;
    expect(classifyEnrichmentDepth(ed)).toBe("minimal");
  });

  it("counts fundingSignals as 1 field", () => {
    const ed = {
      fundingSignals: [{ detail: "Series A", date: null, source: null }],
    } as EnrichmentData;
    expect(classifyEnrichmentDepth(ed)).toBe("minimal");
  });

  it("counts leadershipChanges as 1 field", () => {
    const ed = {
      leadershipChanges: [{ detail: "New CTO", date: null, source: null }],
    } as unknown as EnrichmentData;
    expect(classifyEnrichmentDepth(ed)).toBe("minimal");
  });

  it("multiple signal types still count as 1 combined field", () => {
    // All signal arrays together count as a single field
    const ed = {
      signals: ["A"],
      hiringSignals: [{ detail: "Hiring", date: null, source: null }],
      fundingSignals: [{ detail: "Funded", date: null, source: null }],
      leadershipChanges: [{ detail: "New CEO", date: null, source: null }],
    } as unknown as EnrichmentData;
    expect(classifyEnrichmentDepth(ed)).toBe("minimal"); // still 1 field
  });

  // ── Edge cases: empty arrays don't count ──

  it("ignores empty painPoints array", () => {
    const ed = {
      companySummary: "A SaaS company",
      painPoints: [],
    } as unknown as EnrichmentData;
    expect(classifyEnrichmentDepth(ed)).toBe("minimal"); // only companySummary counts
  });

  it("ignores empty techStack array", () => {
    const ed = { techStack: [] } as unknown as EnrichmentData;
    expect(classifyEnrichmentDepth(ed)).toBe("none");
  });

  it("ignores empty signals arrays", () => {
    const ed = {
      hiringSignals: [],
      fundingSignals: [],
      leadershipChanges: [],
    } as unknown as EnrichmentData;
    expect(classifyEnrichmentDepth(ed)).toBe("none");
  });

  it("ignores empty string for companySummary", () => {
    const ed = { companySummary: "" } as EnrichmentData;
    expect(classifyEnrichmentDepth(ed)).toBe("none");
  });

  it("ignores empty string for linkedinHeadline", () => {
    const ed = { linkedinHeadline: "" } as EnrichmentData;
    expect(classifyEnrichmentDepth(ed)).toBe("none");
  });

  // ── Boundary: exactly 5 fields = rich ──

  it("returns rich at exactly 5 fields (boundary)", () => {
    const ed = {
      companySummary: "X",
      painPoints: ["pain"],
      products: ["prod"],
      techStack: ["tech"],
      linkedinHeadline: "CEO",
    } as EnrichmentData;
    expect(classifyEnrichmentDepth(ed)).toBe("rich");
  });

  it("returns partial at exactly 3 fields (boundary)", () => {
    const ed = {
      companySummary: "X",
      painPoints: ["pain"],
      linkedinHeadline: "CEO",
    } as EnrichmentData;
    expect(classifyEnrichmentDepth(ed)).toBe("partial");
  });
});

// ─── buildDraftMetadata ───────────────────────────────────

describe("buildDraftMetadata", () => {
  it("returns correct metadata for a lead with enrichment data", () => {
    const lead = {
      enrichmentData: {
        companySummary: "A B2B SaaS platform",
        painPoints: ["slow onboarding"],
        hiringSignals: [{ detail: "Hiring 3 SDRs", date: "2026-02", source: "LinkedIn" }],
        linkedinHeadline: "VP of Growth",
        industry: "SaaS",
      } as EnrichmentData,
      industry: "Technology",
    };

    const meta = buildDraftMetadata(lead, 0, "Hi John, this is the body", "Quick question");
    expect(meta.frameworkName).toBe("PAS (Timeline Hook)");
    expect(meta.enrichmentDepth).toBe("partial"); // companySummary + painPoints + signals + linkedinHeadline = 4
    expect(meta.bodyWordCount).toBe(6); // "Hi John, this is the body"
    expect(meta.leadIndustry).toBe("Technology"); // lead.industry takes priority
    expect(meta.subjectPattern).toBe("Question"); // "Quick question" → Question pattern
    expect(meta.signalCount).toBeGreaterThanOrEqual(1);
    expect(meta.signalType).toBeDefined();
  });

  it("uses enrichmentData industry when lead.industry is null", () => {
    const lead = {
      enrichmentData: {
        industry: "FinTech",
      } as EnrichmentData,
      industry: null,
    };

    const meta = buildDraftMetadata(lead, 1, "Body text here", "Noticed something");
    expect(meta.leadIndustry).toBe("FinTech");
  });

  it("returns null leadIndustry when neither source has industry", () => {
    const lead = {
      enrichmentData: {} as EnrichmentData,
      industry: null,
    };

    const meta = buildDraftMetadata(lead, 2, "Body text", "Some subject");
    expect(meta.leadIndustry).toBeNull();
  });

  it("returns null leadIndustry when no enrichment data", () => {
    const lead = { industry: null };
    const meta = buildDraftMetadata(lead, 0, "Body", "Subject");
    expect(meta.leadIndustry).toBeNull();
  });

  it("uses lead.industry over enrichmentData.industry", () => {
    const lead = {
      enrichmentData: { industry: "Healthcare" } as EnrichmentData,
      industry: "SaaS",
    };
    const meta = buildDraftMetadata(lead, 0, "Body text here", "Subject");
    expect(meta.leadIndustry).toBe("SaaS");
  });

  it("maps step number to correct framework name", () => {
    const lead = { industry: null };
    const frameworks = [
      "PAS (Timeline Hook)",
      "Value-add",
      "Social Proof",
      "New Angle",
      "Micro-value",
      "Breakup",
    ];

    for (let step = 0; step <= 5; step++) {
      const meta = buildDraftMetadata(lead, step, "Body", "Subject");
      expect(meta.frameworkName).toBe(frameworks[step]);
    }
  });

  it("counts body words correctly for multi-word body", () => {
    const lead = { industry: null };
    const body = "This is a test body with exactly ten words in it";
    const meta = buildDraftMetadata(lead, 0, body, "Subject");
    expect(meta.bodyWordCount).toBe(11);
  });

  it("counts body words correctly for single-word body", () => {
    const lead = { industry: null };
    const meta = buildDraftMetadata(lead, 0, "Hello", "Subject");
    expect(meta.bodyWordCount).toBe(1);
  });

  it("handles body with extra whitespace", () => {
    const lead = { industry: null };
    const body = "  Hello   world   ";
    const meta = buildDraftMetadata(lead, 0, body, "Subject");
    expect(meta.bodyWordCount).toBe(2);
  });

  it("detects Question subject pattern", () => {
    const lead = { industry: null };
    const meta = buildDraftMetadata(lead, 0, "Body", "How do you handle scaling?");
    expect(meta.subjectPattern).toBe("Question");
  });

  it("detects Personalized subject pattern", () => {
    const lead = { industry: null };
    const meta = buildDraftMetadata(lead, 0, "Body", "re: your recent funding");
    expect(meta.subjectPattern).toBe("Personalized");
  });

  it("detects Observation subject pattern", () => {
    const lead = { industry: null };
    // "noticed your" matches Personalized first in detectSubjectPattern priority order
    // Use a subject that hits Observation path: contains "spotted" without "your"
    const meta = buildDraftMetadata(lead, 0, "Body", "Spotted a trend in SaaS hiring");
    expect(meta.subjectPattern).toBe("Observation");
  });

  it("returns signalType null and signalCount 0 when no enrichment data", () => {
    const lead = { industry: null };
    const meta = buildDraftMetadata(lead, 0, "Body", "Subject");
    expect(meta.signalType).toBeNull();
    expect(meta.signalCount).toBe(0);
  });

  it("returns signalType null and signalCount 0 when enrichment has no signals", () => {
    const lead = {
      enrichmentData: {
        companySummary: "A company",
      } as EnrichmentData,
      industry: null,
    };
    const meta = buildDraftMetadata(lead, 0, "Body", "Subject");
    expect(meta.signalType).toBeNull();
    expect(meta.signalCount).toBe(0);
  });

  it("classifies enrichmentDepth correctly via buildDraftMetadata", () => {
    const noneLead = { industry: null };
    expect(buildDraftMetadata(noneLead, 0, "B", "S").enrichmentDepth).toBe("none");

    const minimalLead = {
      enrichmentData: { companySummary: "X" } as EnrichmentData,
      industry: null,
    };
    expect(buildDraftMetadata(minimalLead, 0, "B", "S").enrichmentDepth).toBe("minimal");

    const richLead = {
      enrichmentData: {
        companySummary: "X",
        painPoints: ["p"],
        products: ["pr"],
        techStack: ["t"],
        linkedinHeadline: "CEO",
      } as EnrichmentData,
      industry: null,
    };
    expect(buildDraftMetadata(richLead, 0, "B", "S").enrichmentDepth).toBe("rich");
  });

  it("returns all expected metadata keys", () => {
    const lead = { industry: "SaaS" };
    const meta = buildDraftMetadata(lead, 0, "Body text", "Question?");
    const keys = Object.keys(meta).sort();
    expect(keys).toEqual([
      "bodyWordCount",
      "enrichmentDepth",
      "frameworkName",
      "leadIndustry",
      "signalCount",
      "signalType",
      "subjectPattern",
    ]);
  });
});
