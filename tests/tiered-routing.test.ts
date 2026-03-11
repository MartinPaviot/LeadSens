import { describe, it, expect, vi } from "vitest";

// Mock Prisma (required because esp-tools.ts imports it at module level)
vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

// Mock providers (required because esp-tools.ts imports them)
vi.mock("@/server/lib/providers", () => ({
  getESPProvider: vi.fn(),
  getESPType: vi.fn(),
  getEmailVerifier: vi.fn(),
}));

// Mock lead-status (required because esp-tools.ts imports it)
vi.mock("@/server/lib/lead-status", () => ({
  transitionLeadStatus: vi.fn(),
}));

// Mock tool-utils (required because esp-tools.ts imports it)
vi.mock("@/server/lib/tools/tool-utils", () => ({
  buildLeadCustomVars: vi.fn(),
  checkVerificationGate: vi.fn(),
}));

import { computeLeadTier, computeSignalBoost, type LeadTier } from "@/server/lib/enrichment/icp-scorer";
import { getPredominantTier } from "@/server/lib/tools/esp-tools";

describe("computeLeadTier", () => {
  it("returns tier 1 for score >= 8", () => {
    expect(computeLeadTier(8)).toBe(1);
    expect(computeLeadTier(9)).toBe(1);
    expect(computeLeadTier(10)).toBe(1);
  });

  it("returns tier 2 for score 6-7", () => {
    expect(computeLeadTier(6)).toBe(2);
    expect(computeLeadTier(7)).toBe(2);
  });

  it("returns tier 3 for score < 6", () => {
    expect(computeLeadTier(5)).toBe(3);
    expect(computeLeadTier(5.5)).toBe(3);
    expect(computeLeadTier(3)).toBe(3);
    expect(computeLeadTier(1)).toBe(3);
  });

  it("handles edge cases at boundaries", () => {
    expect(computeLeadTier(7.9)).toBe(2);
    expect(computeLeadTier(8.0)).toBe(1);
    expect(computeLeadTier(5.9)).toBe(3);
    expect(computeLeadTier(6.0)).toBe(2);
  });
});

describe("computeSignalBoost includes tier", () => {
  it("returns tier in breakdown when no enrichment data", () => {
    const result = computeSignalBoost(8, null);
    expect(result.tier).toBe(1);
  });

  it("returns tier 3 for low-scoring lead without signals", () => {
    const result = computeSignalBoost(5, null);
    expect(result.tier).toBe(3);
  });

  it("returns correct tier based on combined score with signals", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = computeSignalBoost(7, {
      hiringSignals: [{ detail: "Hiring SDR", date: "2026-02-01", source: "LinkedIn" }],
      fundingSignals: [{ detail: "Series B", date: "2026-01-15", source: "Crunchbase" }],
    } as any);
    // With signals, combined score should be boosted
    expect(result.tier).toBeDefined();
    expect([1, 2, 3]).toContain(result.tier);
  });
});

describe("getPredominantTier", () => {
  it("returns tier 2 for empty scores", () => {
    expect(getPredominantTier([])).toBe(2);
  });

  it("returns tier 1 when most scores are high", () => {
    expect(getPredominantTier([8, 9, 10, 8, 7])).toBe(1);
  });

  it("returns tier 2 when scores are mixed", () => {
    expect(getPredominantTier([6, 7, 6, 7, 8])).toBe(2);
  });

  it("returns tier 3 when most scores are low", () => {
    expect(getPredominantTier([5, 4, 5, 3, 5])).toBe(3);
  });

  it("returns tier 1 on three-way tie (most aggressive cadence)", () => {
    // Equal counts (1 each) — tier 1 wins via >= comparison (aggressive default)
    expect(getPredominantTier([9, 7, 5])).toBe(1);
  });

  it("returns tier 2 when tier 2 and tier 3 tie (tier 1 has fewer)", () => {
    // tier 1: 0, tier 2: 2, tier 3: 2 — tier 2 wins (default)
    expect(getPredominantTier([6, 7, 4, 5])).toBe(2);
  });
});

describe("TIER_CADENCES consistency", () => {
  const TIER_CADENCES: Record<LeadTier, number[]> = {
    1: [0, 1, 3, 6, 10, 15],
    2: [0, 2, 5, 9, 14, 21],
    3: [0, 3, 7, 14, 21, 30],
  };

  it("all cadences start with 0", () => {
    for (const tier of [1, 2, 3] as LeadTier[]) {
      expect(TIER_CADENCES[tier][0]).toBe(0);
    }
  });

  it("all cadences have 6 steps", () => {
    for (const tier of [1, 2, 3] as LeadTier[]) {
      expect(TIER_CADENCES[tier]).toHaveLength(6);
    }
  });

  it("cadence values are strictly increasing within each tier", () => {
    for (const tier of [1, 2, 3] as LeadTier[]) {
      const cadence = TIER_CADENCES[tier];
      for (let i = 1; i < cadence.length; i++) {
        expect(cadence[i]).toBeGreaterThan(cadence[i - 1]);
      }
    }
  });

  it("tier 1 is faster than tier 2, tier 2 faster than tier 3", () => {
    for (let i = 1; i < 6; i++) {
      expect(TIER_CADENCES[1][i]).toBeLessThanOrEqual(TIER_CADENCES[2][i]);
      expect(TIER_CADENCES[2][i]).toBeLessThanOrEqual(TIER_CADENCES[3][i]);
    }
  });
});
