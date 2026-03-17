import { describe, it, expect } from "vitest";
import {
  computeEnrichmentCompleteness,
  COMPLETENESS_FIELD_COUNT,
} from "@/server/lib/tools/enrichment-tools";

// ─── Helpers ────────────────────────────────────────────

/** Returns an empty enrichment data record (all fields null/[]) */
function emptyData(): Record<string, unknown> {
  return {
    companySummary: null,
    products: [],
    targetMarket: null,
    valueProposition: null,
    painPoints: [],
    recentNews: [],
    techStack: [],
    teamSize: null,
    hiringSignals: [],
    fundingSignals: [],
    productLaunches: [],
    leadershipChanges: [],
    publicPriorities: [],
    techStackChanges: [],
    linkedinHeadline: null,
    recentLinkedInPosts: [],
    careerHistory: [],
    industry: null,
  };
}

/** Returns a fully populated enrichment data record */
function fullData(): Record<string, unknown> {
  return {
    companySummary: "A SaaS company",
    products: ["Product A"],
    targetMarket: "SMBs",
    valueProposition: "Save time",
    painPoints: ["Manual processes"],
    recentNews: ["Launched v2"],
    techStack: ["React", "Node.js"],
    teamSize: "50-100",
    hiringSignals: [{ detail: "Hiring 5 engineers", date: "2026-01", source: "careers" }],
    fundingSignals: [{ detail: "Series A $10M", date: "2025-11", source: "press" }],
    productLaunches: ["v2.0 launch"],
    leadershipChanges: [{ event: "New CTO", date: "2026-02", source: "blog" }],
    publicPriorities: [{ statement: "Expand APAC", date: "2026-01", source: "interview" }],
    techStackChanges: [{ change: "Migrated to K8s", date: "2025-Q4" }],
    linkedinHeadline: "VP Engineering at Acme",
    recentLinkedInPosts: ["Great quarter for the team"],
    careerHistory: ["VP Eng at Acme (2024-present)", "Sr Eng at Beta (2020-2024)"],
    industry: "SaaS",
  };
}

// ─── Tests ──────────────────────────────────────────────

describe("computeEnrichmentCompleteness", () => {
  it("returns 0 for completely empty data", () => {
    expect(computeEnrichmentCompleteness(emptyData())).toBe(0);
  });

  it("returns 1.0 for fully populated data", () => {
    expect(computeEnrichmentCompleteness(fullData())).toBe(1);
  });

  it("counts 18 total fields", () => {
    expect(COMPLETENESS_FIELD_COUNT).toBe(18);
  });

  it("handles single string field filled", () => {
    const data = emptyData();
    data.companySummary = "A company";
    // 1/18 ≈ 0.06
    expect(computeEnrichmentCompleteness(data)).toBeCloseTo(1 / 18, 2);
  });

  it("handles single array field filled", () => {
    const data = emptyData();
    data.painPoints = ["Manual work"];
    expect(computeEnrichmentCompleteness(data)).toBeCloseTo(1 / 18, 2);
  });

  it("ignores empty strings", () => {
    const data = emptyData();
    data.companySummary = "";
    expect(computeEnrichmentCompleteness(data)).toBe(0);
  });

  it("ignores empty arrays", () => {
    const data = emptyData();
    data.products = [];
    expect(computeEnrichmentCompleteness(data)).toBe(0);
  });

  it("handles partial enrichment (typical web-only)", () => {
    const data = emptyData();
    data.companySummary = "Acme Corp builds widgets";
    data.products = ["Widget Pro"];
    data.painPoints = ["Legacy systems"];
    data.industry = "Manufacturing";
    data.targetMarket = "Enterprise manufacturers";
    // 5/18 ≈ 0.28
    expect(computeEnrichmentCompleteness(data)).toBeCloseTo(5 / 18, 2);
  });

  it("handles rich enrichment (web + LinkedIn + Apollo)", () => {
    const data = emptyData();
    data.companySummary = "A SaaS company";
    data.products = ["Product A"];
    data.painPoints = ["Pain 1"];
    data.industry = "SaaS";
    data.targetMarket = "SMBs";
    data.valueProposition = "Save time";
    data.linkedinHeadline = "VP Sales";
    data.careerHistory = ["VP Sales at Acme"];
    data.hiringSignals = [{ detail: "Hiring", date: null, source: null }];
    data.techStack = ["React"];
    // 10/18 ≈ 0.56
    expect(computeEnrichmentCompleteness(data)).toBeCloseTo(10 / 18, 2);
  });

  it("does not count narrative/derived fields", () => {
    const data = emptyData();
    data.enrichmentContext = "Some context";
    data.enrichmentLinkedin = "LinkedIn summary";
    data.enrichmentSignals = "Some signals";
    data.enrichmentDiagnostic = "A diagnostic";
    // Derived fields are excluded — should still be 0
    expect(computeEnrichmentCompleteness(data)).toBe(0);
  });

  it("does not count generic signals array", () => {
    const data = emptyData();
    data.signals = ["signal1", "signal2"];
    // Generic signals excluded — should still be 0
    expect(computeEnrichmentCompleteness(data)).toBe(0);
  });

  it("handles missing fields gracefully (undefined)", () => {
    // Sparse object — only has a few fields
    const data: Record<string, unknown> = {
      companySummary: "A company",
      industry: "Tech",
    };
    // 2/18 ≈ 0.11
    expect(computeEnrichmentCompleteness(data)).toBeCloseTo(2 / 18, 2);
  });

  it("rounds to 2 decimal places", () => {
    const data = emptyData();
    data.companySummary = "Company";
    data.industry = "SaaS";
    data.linkedinHeadline = "VP";
    // 3/18 = 0.16666... → 0.17
    expect(computeEnrichmentCompleteness(data)).toBe(0.17);
  });

  it("returns correct score at 40% threshold boundary", () => {
    const data = emptyData();
    // Fill 7 fields → 7/18 = 0.39 (below 0.4 threshold)
    data.companySummary = "A";
    data.products = ["P"];
    data.painPoints = ["P"];
    data.industry = "SaaS";
    data.linkedinHeadline = "VP";
    data.careerHistory = ["Career"];
    data.targetMarket = "SMBs";
    expect(computeEnrichmentCompleteness(data)).toBe(0.39);

    // Fill 8 fields → 8/18 = 0.44 (above threshold)
    data.techStack = ["React"];
    expect(computeEnrichmentCompleteness(data)).toBe(0.44);
  });
});
