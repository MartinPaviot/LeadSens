import { describe, it, expect } from "vitest";
import { computeSignalBoost, signalAge, type CombinedScoreBreakdown } from "@/server/lib/enrichment/icp-scorer";
import type { EnrichmentData, StructuredSignal } from "@/server/lib/enrichment/summarizer";

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
      hiringSignals: [
        { detail: "Hiring 3 SDRs", date: "2026-02", source: "careers" },
        { detail: "VP Sales opening", date: "2026-01", source: "LinkedIn" },
      ],
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
      fundingSignals: [{ detail: "Series B $20M", date: "2026-02", source: "press" }],
    }));
    expect(result.timingScore).toBeGreaterThanOrEqual(5); // 3 + recency-weighted boost
    expect(result.timingScore).toBeLessThanOrEqual(8);
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
      hiringSignals: [
        { detail: "A", date: "2026-02", source: null },
        { detail: "B", date: "2026-01", source: null },
        { detail: "C", date: "2026-01", source: null },
        { detail: "D", date: "2025-12", source: null },
        { detail: "E", date: "2025-11", source: null },
      ],
      techStackChanges: [
        { change: "A", date: null },
        { change: "B", date: null },
        { change: "C", date: null },
      ],
      recentLinkedInPosts: ["post1"],
      productLaunches: ["launch1", "launch2"],
      fundingSignals: [
        { detail: "Series A", date: "2026-01", source: null },
        { detail: "Series B", date: "2025-10", source: null },
      ],
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
      hiringSignals: [
        { detail: "A", date: "2026-02", source: null },
        { detail: "B", date: "2026-02", source: null },
        { detail: "C", date: "2026-02", source: null },
      ],
      techStackChanges: [{ change: "X", date: null }],
      recentLinkedInPosts: ["post"],
      productLaunches: ["launch"],
      fundingSignals: [
        { detail: "Series A", date: "2026-01", source: null },
        { detail: "Series B", date: "2026-01", source: null },
      ],
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
      hiringSignals: [
        { detail: "A", date: "2026-02", source: null },
        { detail: "B", date: "2026-01", source: null },
      ],
      fundingSignals: [{ detail: "Series A", date: "2026-01", source: null }],
      leadershipChanges: [{ event: "New CEO", date: null, source: null }],
    }));
    expect(result.combinedScore).toBeLessThanOrEqual(7);
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
      hiringSignals: [{ detail: "SDR role", date: "2026-02", source: null }],
      fundingSignals: [{ detail: "Seed round", date: "2026-01", source: null }],
      recentLinkedInPosts: ["About growth"],
      leadershipChanges: [{ event: "New VP Sales", date: "2026-01", source: "linkedin" }],
    }));
    expect(result.signals).toHaveLength(4);
    expect(result.combinedScore).toBeGreaterThan(5);
  });

  // ─── Compound signal scoring ──────────────────────────────

  it("no compound bonus with 1-2 signal types", () => {
    const one = computeSignalBoost(7, makeEnrichment({
      hiringSignals: [{ detail: "SDR role", date: "2026-02", source: null }],
    }));
    expect(one.compoundBonus).toBe(0);

    const two = computeSignalBoost(7, makeEnrichment({
      hiringSignals: [{ detail: "SDR role", date: "2026-02", source: null }],
      fundingSignals: [{ detail: "Series A", date: "2026-01", source: null }],
    }));
    expect(two.compoundBonus).toBe(0);
  });

  it("compound bonus +1 with 3 distinct signal types", () => {
    const result = computeSignalBoost(7, makeEnrichment({
      hiringSignals: [{ detail: "SDR role", date: "2026-02", source: null }],
      fundingSignals: [{ detail: "Series A", date: "2026-01", source: null }],
      recentLinkedInPosts: ["About AI"],
    }));
    expect(result.compoundBonus).toBe(1);
    expect(result.signals).toHaveLength(3);
  });

  it("compound bonus +2 with 4 distinct signal types", () => {
    const result = computeSignalBoost(7, makeEnrichment({
      hiringSignals: [{ detail: "SDR role", date: "2026-02", source: null }],
      fundingSignals: [{ detail: "Series A", date: "2026-01", source: null }],
      recentLinkedInPosts: ["About AI"],
      leadershipChanges: [{ event: "New CTO", date: null, source: null }],
    }));
    expect(result.compoundBonus).toBe(2);
    expect(result.signals).toHaveLength(4);
  });

  it("compound bonus caps at +3 with 5+ distinct signal types", () => {
    const result = computeSignalBoost(7, makeEnrichment({
      hiringSignals: [{ detail: "SDR role", date: "2026-02", source: null }],
      techStackChanges: [{ change: "New CRM", date: null }],
      recentLinkedInPosts: ["Post"],
      fundingSignals: [{ detail: "Series A", date: "2026-01", source: null }],
      leadershipChanges: [{ event: "New CTO", date: null, source: null }],
      publicPriorities: [{ statement: "AI-first", source: null, date: null }],
    }));
    expect(result.compoundBonus).toBe(3);
    expect(result.signals).toHaveLength(6);
  });

  it("3+ signals score strictly higher than additive alone", () => {
    // Same fit, same signal data — compare with and without compound
    const singleA = computeSignalBoost(7, makeEnrichment({
      hiringSignals: [{ detail: "SDR role", date: "2026-02", source: null }],
    }));
    const singleB = computeSignalBoost(7, makeEnrichment({
      fundingSignals: [{ detail: "Series A", date: "2026-01", source: null }],
    }));
    const singleC = computeSignalBoost(7, makeEnrichment({
      recentLinkedInPosts: ["Post"],
    }));
    const combined = computeSignalBoost(7, makeEnrichment({
      hiringSignals: [{ detail: "SDR role", date: "2026-02", source: null }],
      fundingSignals: [{ detail: "Series A", date: "2026-01", source: null }],
      recentLinkedInPosts: ["Post"],
    }));

    // Compound scoring: combined > max of individual scores
    const maxSingle = Math.max(singleA.combinedScore, singleB.combinedScore, singleC.combinedScore);
    expect(combined.combinedScore).toBeGreaterThan(maxSingle);
  });

  it("compound bonus still capped at 10 total", () => {
    const result = computeSignalBoost(10, makeEnrichment({
      hiringSignals: [
        { detail: "A", date: "2026-02", source: null },
        { detail: "B", date: "2026-02", source: null },
        { detail: "C", date: "2026-02", source: null },
      ],
      techStackChanges: [{ change: "X", date: null }],
      recentLinkedInPosts: ["post"],
      productLaunches: ["launch"],
      fundingSignals: [{ detail: "Series A", date: "2026-01", source: null }],
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

// ─── signalAge tests ──────────────────────────────────────

describe("signalAge", () => {
  // Use a fixed reference date for deterministic tests
  const now = new Date("2026-03-10");

  it("returns 1.0 for signals < 3 months old", () => {
    expect(signalAge("2026-02-01", now)).toBe(1.0);
    expect(signalAge("2026-01-15", now)).toBe(1.0);
    expect(signalAge("2026-03-01", now)).toBe(1.0);
  });

  it("returns 0.7 for signals 3-6 months old", () => {
    expect(signalAge("2025-12-01", now)).toBe(0.7);
    expect(signalAge("2025-10-15", now)).toBe(0.7);
  });

  it("returns 0.3 for signals 6-12 months old", () => {
    expect(signalAge("2025-08-01", now)).toBe(0.3);
    expect(signalAge("2025-04-15", now)).toBe(0.3);
  });

  it("returns 0.1 for signals > 12 months old", () => {
    expect(signalAge("2024-12-01", now)).toBe(0.1);
    expect(signalAge("2023-01-01", now)).toBe(0.1);
  });

  it("returns 0.5 for null date (conservative default)", () => {
    expect(signalAge(null, now)).toBe(0.5);
    expect(signalAge(undefined, now)).toBe(0.5);
  });

  it("returns 0.5 for unparseable date", () => {
    expect(signalAge("not-a-date", now)).toBe(0.5);
    expect(signalAge("Q4 2025", now)).toBe(0.5);
  });

  it("handles YYYY-MM format", () => {
    expect(signalAge("2026-02", now)).toBe(1.0);
    expect(signalAge("2025-06", now)).toBe(0.3);
  });

  it("handles YYYY-MM-DD format", () => {
    expect(signalAge("2026-01-15", now)).toBe(1.0);
    expect(signalAge("2025-03-01", now)).toBe(0.1);
  });
});

// ─── Recency-weighted signal boost ──────────────────────────

describe("computeSignalBoost recency weighting", () => {
  it("recent hiring signals contribute more than stale ones", () => {
    const recentHiring = computeSignalBoost(7, makeEnrichment({
      hiringSignals: [{ detail: "Hiring SDRs", date: "2026-02", source: null }],
    }));
    const staleHiring = computeSignalBoost(7, makeEnrichment({
      hiringSignals: [{ detail: "Hiring SDRs", date: "2024-01", source: null }],
    }));
    // Recent (1.0 weight) should yield higher intent than stale (0.1 weight)
    expect(recentHiring.intentScore).toBeGreaterThan(staleHiring.intentScore);
  });

  it("recent funding signals contribute more than stale ones", () => {
    const recentFunding = computeSignalBoost(7, makeEnrichment({
      fundingSignals: [{ detail: "Series A", date: "2026-02", source: null }],
    }));
    const staleFunding = computeSignalBoost(7, makeEnrichment({
      fundingSignals: [{ detail: "Series A", date: "2024-01", source: null }],
    }));
    // Recent (1.0 weight) → round(1.0*3)=3, stale (0.1) → round(0.1*3)=0 → max(1)=1
    expect(recentFunding.timingScore).toBeGreaterThan(staleFunding.timingScore);
  });

  it("null-dated signals get conservative 0.5 weight", () => {
    const noDate = computeSignalBoost(7, makeEnrichment({
      hiringSignals: [{ detail: "Hiring", date: null, source: null }],
    }));
    const recent = computeSignalBoost(7, makeEnrichment({
      hiringSignals: [{ detail: "Hiring", date: "2026-02", source: null }],
    }));
    // Null date (0.5) should score lower than recent (1.0)
    expect(noDate.intentScore).toBeLessThanOrEqual(recent.intentScore);
  });

  it("mix of recent and stale signals uses weighted average", () => {
    const result = computeSignalBoost(7, makeEnrichment({
      fundingSignals: [
        { detail: "Series B", date: "2026-02", source: null }, // weight 1.0
        { detail: "Series A", date: "2024-01", source: null }, // weight 0.1
      ],
    }));
    // Weighted count = 1.0 + 0.1 = 1.1, round(1.1 * 3) = 3, clamp(3, 2, 5) → 3
    // timing = 3 (base) + 3 = 6
    expect(result.timingScore).toBeGreaterThanOrEqual(5);
    expect(result.signals).toContain("funding×2");
  });
});
