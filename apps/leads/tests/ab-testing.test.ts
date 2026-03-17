import { describe, it, expect } from "vitest";
import {
  calculateZTest,
  canRunZTest,
  findLosingVariant,
  MIN_SENDS_PER_VARIANT,
  MIN_CAMPAIGN_AGE_DAYS,
  Z_THRESHOLD_95,
} from "@/server/lib/analytics/ab-testing";
import type { VariantPerformanceRow } from "@/server/lib/analytics/correlator";

// Helper to create a VariantPerformanceRow
function makeVariant(
  variantIndex: number,
  sent: number,
  replied: number,
  subject = `Variant ${variantIndex}`,
): VariantPerformanceRow {
  return {
    variantIndex,
    subject,
    sent,
    opened: Math.round(sent * 0.4),
    replied,
    openRate: sent > 0 ? Math.round((Math.round(sent * 0.4) / sent) * 10000) / 100 : 0,
    replyRate: sent > 0 ? Math.round((replied / sent) * 10000) / 100 : 0,
  };
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ─── calculateZTest ────────────────────────────────────

describe("calculateZTest", () => {
  it("returns z=0 and not significant for zero sample sizes", () => {
    expect(calculateZTest(0, 0, 0, 0)).toEqual({ z: 0, significant: false });
    expect(calculateZTest(0, 0, 100, 10)).toEqual({ z: 0, significant: false });
    expect(calculateZTest(100, 10, 0, 0)).toEqual({ z: 0, significant: false });
  });

  it("returns not significant for identical proportions", () => {
    const result = calculateZTest(200, 20, 200, 20);
    expect(result.z).toBe(0);
    expect(result.significant).toBe(false);
  });

  it("returns not significant for small differences", () => {
    // 10% vs 11% with n=100 each — too small to be significant
    const result = calculateZTest(100, 10, 100, 11);
    expect(result.significant).toBe(false);
  });

  it("returns significant for large differences with sufficient sample", () => {
    // 5% vs 15% with n=200 each — clearly significant
    const result = calculateZTest(200, 10, 200, 30);
    expect(result.significant).toBe(true);
    expect(Math.abs(result.z)).toBeGreaterThan(Z_THRESHOLD_95);
  });

  it("computes correct z-score for known values", () => {
    // Manual calculation: p1 = 0.10, p2 = 0.05, pPool = 0.075
    // SE = sqrt(0.075 * 0.925 * (1/200 + 1/200)) = sqrt(0.075 * 0.925 * 0.01) = 0.02634
    // z = (0.10 - 0.05) / 0.02634 ≈ 1.898
    const result = calculateZTest(200, 20, 200, 10);
    expect(result.z).toBeCloseTo(1.898, 1);
    // 1.898 < 1.96, so NOT significant at 95% CI
    expect(result.significant).toBe(false);
  });

  it("handles all-zero replies (pPool = 0)", () => {
    const result = calculateZTest(100, 0, 100, 0);
    expect(result.z).toBe(0);
    expect(result.significant).toBe(false);
  });

  it("handles all-success replies (pPool = 1)", () => {
    const result = calculateZTest(100, 100, 100, 100);
    expect(result.z).toBe(0);
    expect(result.significant).toBe(false);
  });

  it("produces correct sign (positive when p1 > p2)", () => {
    const result = calculateZTest(200, 30, 200, 10);
    expect(result.z).toBeGreaterThan(0);
  });

  it("produces negative z when p1 < p2", () => {
    const result = calculateZTest(200, 10, 200, 30);
    expect(result.z).toBeLessThan(0);
  });

  it("rounds z to 3 decimal places", () => {
    const result = calculateZTest(150, 20, 150, 5);
    const decimalPlaces = result.z.toString().split(".")[1]?.length ?? 0;
    expect(decimalPlaces).toBeLessThanOrEqual(3);
  });
});

// ─── canRunZTest ───────────────────────────────────────

describe("canRunZTest", () => {
  it("requires at least 2 variants", () => {
    const result = canRunZTest([makeVariant(0, 200, 20)], daysAgo(10));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("2 variants");
  });

  it("requires campaign age >= MIN_CAMPAIGN_AGE_DAYS", () => {
    const variants = [makeVariant(0, 200, 20), makeVariant(1, 200, 10)];
    const result = canRunZTest(variants, daysAgo(3));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("days old");
  });

  it("requires MIN_SENDS_PER_VARIANT per variant", () => {
    const variants = [makeVariant(0, 200, 20), makeVariant(1, 50, 5)];
    const result = canRunZTest(variants, daysAgo(10));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain(`< ${MIN_SENDS_PER_VARIANT} sends`);
  });

  it("returns eligible when all conditions met", () => {
    const variants = [makeVariant(0, 200, 20), makeVariant(1, 200, 10)];
    const result = canRunZTest(variants, daysAgo(10));
    expect(result.eligible).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("returns eligible at exact thresholds", () => {
    const variants = [
      makeVariant(0, MIN_SENDS_PER_VARIANT, 10),
      makeVariant(1, MIN_SENDS_PER_VARIANT, 5),
    ];
    const result = canRunZTest(variants, daysAgo(MIN_CAMPAIGN_AGE_DAYS));
    expect(result.eligible).toBe(true);
  });

  it("works with 3 variants", () => {
    const variants = [
      makeVariant(0, 200, 20),
      makeVariant(1, 200, 10),
      makeVariant(2, 200, 15),
    ];
    const result = canRunZTest(variants, daysAgo(10));
    expect(result.eligible).toBe(true);
  });
});

// ─── findLosingVariant ─────────────────────────────────

describe("findLosingVariant", () => {
  it("returns null when not eligible", () => {
    const variants = [makeVariant(0, 50, 5), makeVariant(1, 50, 3)];
    expect(findLosingVariant(variants, daysAgo(10))).toBeNull();
  });

  it("returns null when no significant difference", () => {
    // Very close reply rates with small samples
    const variants = [makeVariant(0, 100, 10), makeVariant(1, 100, 9)];
    expect(findLosingVariant(variants, daysAgo(10))).toBeNull();
  });

  it("identifies loser when significant difference exists", () => {
    // 15% vs 3% with n=200 each — clearly significant
    const variants = [
      makeVariant(0, 200, 30, "Winning subject"),
      makeVariant(1, 200, 6, "Losing subject"),
    ];
    const result = findLosingVariant(variants, daysAgo(10));
    expect(result).not.toBeNull();
    expect(result!.loser.variantIndex).toBe(1);
    expect(result!.winner.variantIndex).toBe(0);
    expect(result!.zTest.significant).toBe(true);
  });

  it("handles winner not being first in array", () => {
    // Variant 1 wins
    const variants = [
      makeVariant(0, 200, 6, "Losing subject"),
      makeVariant(1, 200, 30, "Winning subject"),
    ];
    const result = findLosingVariant(variants, daysAgo(10));
    expect(result).not.toBeNull();
    expect(result!.winner.variantIndex).toBe(1);
    expect(result!.loser.variantIndex).toBe(0);
  });

  it("returns null when all reply rates are equal", () => {
    const variants = [makeVariant(0, 200, 20), makeVariant(1, 200, 20)];
    expect(findLosingVariant(variants, daysAgo(10))).toBeNull();
  });

  it("compares best vs worst with 3 variants", () => {
    // 12% vs 8% vs 3% with n=200 each
    const variants = [
      makeVariant(0, 200, 24, "Best"),
      makeVariant(1, 200, 16, "Middle"),
      makeVariant(2, 200, 6, "Worst"),
    ];
    const result = findLosingVariant(variants, daysAgo(10));
    expect(result).not.toBeNull();
    expect(result!.winner.subject).toBe("Best");
    expect(result!.loser.subject).toBe("Worst");
  });

  it("returns null when campaign too young", () => {
    const variants = [
      makeVariant(0, 200, 30),
      makeVariant(1, 200, 6),
    ];
    expect(findLosingVariant(variants, daysAgo(2))).toBeNull();
  });

  it("includes z-test result with correct z-score", () => {
    const variants = [
      makeVariant(0, 200, 30),
      makeVariant(1, 200, 6),
    ];
    const result = findLosingVariant(variants, daysAgo(10));
    expect(result).not.toBeNull();
    expect(result!.zTest.z).not.toBe(0);
    expect(Math.abs(result!.zTest.z)).toBeGreaterThan(Z_THRESHOLD_95);
  });
});

// ─── Integration edge cases ───────────────────────────

describe("edge cases", () => {
  it("z-test is symmetric (swapping variants gives same |z|)", () => {
    const r1 = calculateZTest(200, 30, 200, 10);
    const r2 = calculateZTest(200, 10, 200, 30);
    expect(Math.abs(r1.z)).toBeCloseTo(Math.abs(r2.z), 5);
    expect(r1.significant).toBe(r2.significant);
  });

  it("larger sample sizes make smaller differences significant", () => {
    // 10% vs 8% — not significant at n=100
    const small = calculateZTest(100, 10, 100, 8);
    // 10% vs 8% — significant at n=2000
    const large = calculateZTest(2000, 200, 2000, 160);
    expect(small.significant).toBe(false);
    expect(large.significant).toBe(true);
  });

  it("handles single reply difference correctly", () => {
    // n=100 each, 5 vs 4 replies — not significant
    const result = calculateZTest(100, 5, 100, 4);
    expect(result.significant).toBe(false);
  });
});
