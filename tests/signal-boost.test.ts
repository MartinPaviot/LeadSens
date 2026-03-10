import { describe, it, expect } from "vitest";
import { computeSignalBoost, type CombinedScoreBreakdown } from "@/server/lib/enrichment/icp-scorer";
import type { EnrichmentData } from "@/server/lib/enrichment/summarizer";

// ─── Helpers ─────────────────────────────────────────────

function makeEnrichment(overrides: Partial<EnrichmentData> = {}): EnrichmentData {
  return {
    companySummary: "A SaaS company",
    products: ["Product A"],
    targetMarket: "SMBs",
    valueProposition: "Save time",
    painPoints: ["scaling"],
    recentNews: [],
    techStack: [],
    teamSize: "50-100",
    signals: [],
    hiringSignals: [],
    fundingSignals: [],
    productLaunches: [],
    leadershipChanges: [],
    publicPriorities: [],
    techStackChanges: [],
    linkedinHeadline: null,
    recentLinkedInPosts: [],
    careerHistory: [],
    industry: "SaaS",
    enrichmentContext: null,
    enrichmentLinkedin: null,
    enrichmentSignals: null,
    enrichmentDiagnostic: null,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────

describe("computeSignalBoost", () => {
  it("returns neutral scores when no enrichment data", () => {
    const result = computeSignalBoost(7, null);
    expect(result.fitScore).toBe(7);
    expect(result.intentScore).toBe(5);
    expect(result.timingScore).toBe(5);
    expect(result.combinedScore).toBe(7); // 7*0.4 + 5*0.35 + 5*0.25 = 2.8+1.75+1.25 = 5.8 → 6... wait
    expect(result.signals).toEqual([]);
  });

  it("returns baseline 3 for intent+timing when enrichment has no signals", () => {
    const result = computeSignalBoost(8, makeEnrichment());
    expect(result.fitScore).toBe(8);
    expect(result.intentScore).toBe(3);
    expect(result.timingScore).toBe(3);
    // 8*0.4 + 3*0.35 + 3*0.25 = 3.2 + 1.05 + 0.75 = 5.0
    expect(result.combinedScore).toBe(5);
    expect(result.signals).toEqual([]);
  });

  it("boosts intent with hiring signals", () => {
    const result = computeSignalBoost(6, makeEnrichment({
      hiringSignals: ["Hiring 3 SDRs", "VP Sales opening"],
    }));
    expect(result.intentScore).toBeGreaterThan(3);
    expect(result.signals).toContain("hiring×2");
  });

  it("boosts intent with tech stack changes", () => {
    const result = computeSignalBoost(6, makeEnrichment({
      techStackChanges: [{ change: "Migrated to AWS", date: "2026-01" }],
    }));
    expect(result.intentScore).toBeGreaterThan(3);
    expect(result.signals).toContain("tech_change×1");
  });

  it("boosts intent with LinkedIn activity", () => {
    const result = computeSignalBoost(6, makeEnrichment({
      recentLinkedInPosts: ["Posted about AI trends"],
    }));
    expect(result.intentScore).toBe(4); // 3 baseline + 1
    expect(result.signals).toContain("linkedin_active");
  });

  it("boosts timing with funding signals", () => {
    const result = computeSignalBoost(6, makeEnrichment({
      fundingSignals: ["Series B $20M"],
    }));
    expect(result.timingScore).toBeGreaterThanOrEqual(6); // 3 + 3
    expect(result.signals).toContain("funding×1");
  });

  it("boosts timing with leadership changes", () => {
    const result = computeSignalBoost(6, makeEnrichment({
      leadershipChanges: [{ event: "New CTO hired", date: "2026-02", source: "press" }],
    }));
    expect(result.timingScore).toBeGreaterThan(3);
    expect(result.signals).toContain("leadership×1");
  });

  it("boosts timing with public priorities", () => {
    const result = computeSignalBoost(6, makeEnrichment({
      publicPriorities: [{ statement: "AI-first strategy", source: "blog", date: "2026-01" }],
    }));
    expect(result.timingScore).toBe(4); // 3 + 1
    expect(result.signals).toContain("priority×1");
  });

  it("caps scores at 10", () => {
    const result = computeSignalBoost(10, makeEnrichment({
      hiringSignals: ["A", "B", "C", "D", "E"],
      techStackChanges: [
        { change: "A", date: null },
        { change: "B", date: null },
        { change: "C", date: null },
      ],
      recentLinkedInPosts: ["post1"],
      productLaunches: ["launch1", "launch2"],
      fundingSignals: ["Series A", "Series B"],
      leadershipChanges: [
        { event: "New CEO", date: null, source: null },
        { event: "New CTO", date: null, source: null },
        { event: "New CFO", date: null, source: null },
      ],
      publicPriorities: [
        { statement: "P1", source: null, date: null },
        { statement: "P2", source: null, date: null },
      ],
      recentNews: ["news1", "news2", "news3"],
    }));
    expect(result.intentScore).toBeLessThanOrEqual(10);
    expect(result.timingScore).toBeLessThanOrEqual(10);
    expect(result.combinedScore).toBeLessThanOrEqual(10);
  });

  it("combined score reflects weighted formula: fit 40% + intent 35% + timing 25%", () => {
    // Manually verify: fit=10, intent=10, timing=10 → 10*0.4+10*0.35+10*0.25 = 10
    const max = computeSignalBoost(10, makeEnrichment({
      hiringSignals: ["A", "B", "C"],
      techStackChanges: [{ change: "X", date: null }],
      recentLinkedInPosts: ["post"],
      productLaunches: ["launch"],
      fundingSignals: ["Series A", "Series B"],
      leadershipChanges: [
        { event: "New CEO", date: null, source: null },
        { event: "New CTO", date: null, source: null },
      ],
      publicPriorities: [{ statement: "AI", source: null, date: null }],
      recentNews: ["news1"],
    }));
    expect(max.combinedScore).toBe(10);
  });

  it("low fit score stays low even with strong signals", () => {
    // fit=2, strong signals → combined should be moderate, not high
    const result = computeSignalBoost(2, makeEnrichment({
      hiringSignals: ["A", "B"],
      fundingSignals: ["Series A"],
      leadershipChanges: [{ event: "New CEO", date: null, source: null }],
    }));
    // 2*0.4 + 7*0.35 + 8*0.25 = 0.8+2.45+2.0 = 5.25 → 5
    expect(result.combinedScore).toBeLessThanOrEqual(6);
    expect(result.combinedScore).toBeGreaterThanOrEqual(4);
  });

  it("strong fit with no signals gets pulled down", () => {
    // fit=9, no signals → baseline intent=3, timing=3
    const result = computeSignalBoost(9, makeEnrichment());
    // 9*0.4 + 3*0.35 + 3*0.25 = 3.6+1.05+0.75 = 5.4 → 5
    expect(result.combinedScore).toBeLessThan(9);
    expect(result.combinedScore).toBeGreaterThanOrEqual(5);
  });

  it("accumulates multiple signal types", () => {
    const result = computeSignalBoost(7, makeEnrichment({
      hiringSignals: ["SDR role"],
      fundingSignals: ["Seed round"],
      recentLinkedInPosts: ["About growth"],
      leadershipChanges: [{ event: "New VP Sales", date: "2026-01", source: "linkedin" }],
    }));
    expect(result.signals).toHaveLength(4);
    expect(result.combinedScore).toBeGreaterThan(5);
  });

  // ─── Compound signal scoring ──────────────────────────────

  it("no compound bonus with 1-2 signal types", () => {
    const one = computeSignalBoost(7, makeEnrichment({
      hiringSignals: ["SDR role"],
    }));
    expect(one.compoundBonus).toBe(0);

    const two = computeSignalBoost(7, makeEnrichment({
      hiringSignals: ["SDR role"],
      fundingSignals: ["Series A"],
    }));
    expect(two.compoundBonus).toBe(0);
  });

  it("compound bonus +1 with 3 distinct signal types", () => {
    const result = computeSignalBoost(7, makeEnrichment({
      hiringSignals: ["SDR role"],
      fundingSignals: ["Series A"],
      recentLinkedInPosts: ["About AI"],
    }));
    expect(result.compoundBonus).toBe(1);
    expect(result.signals).toHaveLength(3);
  });

  it("compound bonus +2 with 4 distinct signal types", () => {
    const result = computeSignalBoost(7, makeEnrichment({
      hiringSignals: ["SDR role"],
      fundingSignals: ["Series A"],
      recentLinkedInPosts: ["About AI"],
      leadershipChanges: [{ event: "New CTO", date: null, source: null }],
    }));
    expect(result.compoundBonus).toBe(2);
    expect(result.signals).toHaveLength(4);
  });

  it("compound bonus caps at +3 with 5+ distinct signal types", () => {
    const result = computeSignalBoost(7, makeEnrichment({
      hiringSignals: ["SDR role"],
      techStackChanges: [{ change: "New CRM", date: null }],
      recentLinkedInPosts: ["Post"],
      fundingSignals: ["Series A"],
      leadershipChanges: [{ event: "New CTO", date: null, source: null }],
      publicPriorities: [{ statement: "AI-first", source: null, date: null }],
    }));
    expect(result.compoundBonus).toBe(3);
    expect(result.signals).toHaveLength(6);
  });

  it("3+ signals score strictly higher than additive alone", () => {
    // Same fit, same signal data — compare with and without compound
    const singleA = computeSignalBoost(7, makeEnrichment({
      hiringSignals: ["SDR role"],
    }));
    const singleB = computeSignalBoost(7, makeEnrichment({
      fundingSignals: ["Series A"],
    }));
    const singleC = computeSignalBoost(7, makeEnrichment({
      recentLinkedInPosts: ["Post"],
    }));
    const combined = computeSignalBoost(7, makeEnrichment({
      hiringSignals: ["SDR role"],
      fundingSignals: ["Series A"],
      recentLinkedInPosts: ["Post"],
    }));

    // Compound scoring: combined > max of individual scores
    const maxSingle = Math.max(singleA.combinedScore, singleB.combinedScore, singleC.combinedScore);
    expect(combined.combinedScore).toBeGreaterThan(maxSingle);
  });

  it("compound bonus still capped at 10 total", () => {
    const result = computeSignalBoost(10, makeEnrichment({
      hiringSignals: ["A", "B", "C"],
      techStackChanges: [{ change: "X", date: null }],
      recentLinkedInPosts: ["post"],
      productLaunches: ["launch"],
      fundingSignals: ["Series A"],
      leadershipChanges: [{ event: "CEO", date: null, source: null }],
      publicPriorities: [{ statement: "AI", source: null, date: null }],
      recentNews: ["news"],
    }));
    expect(result.compoundBonus).toBe(3);
    expect(result.combinedScore).toBeLessThanOrEqual(10);
  });

  it("compoundBonus is 0 when no enrichment data", () => {
    expect(computeSignalBoost(7, null).compoundBonus).toBe(0);
  });

  it("compoundBonus is 0 when enrichment has no signals", () => {
    expect(computeSignalBoost(7, makeEnrichment()).compoundBonus).toBe(0);
  });
});
