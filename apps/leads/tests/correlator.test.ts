import { describe, it, expect } from "vitest";
import {
  isPositiveReply,
  toCorrelationRows,
  toVariantPerformanceRows,
  getSubjectForVariant,
  POSITIVE_REPLY_INTEREST_THRESHOLD,
  type RawRow,
  type RawVariantRow,
} from "@/server/lib/analytics/correlator";

/** Helper to create RawRow with BigInt values */
function row(dimension: string, sent: number, opened: number, replied: number): RawRow {
  return { dimension, sent: BigInt(sent), opened: BigInt(opened), replied: BigInt(replied) };
}

// ─── Constants ──────────────────────────────────────────

describe("positive reply constants", () => {
  it("threshold is 5 (neutral/lukewarm and above)", () => {
    expect(POSITIVE_REPLY_INTEREST_THRESHOLD).toBe(5);
  });
});

// ─── isPositiveReply (pure logic) ───────────────────────

describe("isPositiveReply", () => {
  it("returns false when replyCount is 0", () => {
    expect(isPositiveReply(0, null)).toBe(false);
    expect(isPositiveReply(0, 8)).toBe(false);
    expect(isPositiveReply(0, 1)).toBe(false);
  });

  it("returns true when reply exists but no AI classification (backward compat)", () => {
    expect(isPositiveReply(1, null)).toBe(true);
    expect(isPositiveReply(3, null)).toBe(true);
  });

  it("returns true for positive interest (>= 5)", () => {
    expect(isPositiveReply(1, 5)).toBe(true);   // neutral/lukewarm
    expect(isPositiveReply(1, 6)).toBe(true);
    expect(isPositiveReply(1, 7)).toBe(true);   // interested
    expect(isPositiveReply(1, 8)).toBe(true);
    expect(isPositiveReply(1, 9)).toBe(true);   // very interested
    expect(isPositiveReply(1, 10)).toBe(true);  // meeting booked
  });

  it("returns false for negative interest (< 5)", () => {
    expect(isPositiveReply(1, 1)).toBe(false);  // "stop emailing me"
    expect(isPositiveReply(1, 2)).toBe(false);  // reported spam
    expect(isPositiveReply(1, 3)).toBe(false);  // not interested
    expect(isPositiveReply(1, 4)).toBe(false);  // slightly negative
  });

  it("returns false for negative replyCount", () => {
    expect(isPositiveReply(-1, 8)).toBe(false);
  });

  it("boundary: exactly at threshold (5) is positive", () => {
    expect(isPositiveReply(1, 5)).toBe(true);
  });

  it("boundary: just below threshold (4.9) is negative", () => {
    expect(isPositiveReply(1, 4.9)).toBe(false);
  });
});

// ─── toCorrelationRows (pure logic) ─────────────────────

describe("toCorrelationRows", () => {
  it("filters out rows with < 5 sent", () => {
    const rows: RawRow[] = [
      row("small", 4, 2, 1),
      row("large", 10, 5, 2),
    ];
    const result = toCorrelationRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].dimension).toBe("large");
  });

  it("includes rows with exactly 5 sent", () => {
    const rows: RawRow[] = [row("threshold", 5, 3, 1)];
    const result = toCorrelationRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].dimension).toBe("threshold");
  });

  it("computes correct open and reply rates", () => {
    const rows: RawRow[] = [row("test", 100, 30, 5)];
    const result = toCorrelationRows(rows);
    expect(result[0].sent).toBe(100);
    expect(result[0].opened).toBe(30);
    expect(result[0].replied).toBe(5);
    expect(result[0].openRate).toBe(30);
    expect(result[0].replyRate).toBe(5);
  });

  it("rounds rates to 2 decimal places", () => {
    const rows: RawRow[] = [row("precise", 7, 3, 1)];
    const result = toCorrelationRows(rows);
    // 3/7 = 42.857...% → rounded to 42.86
    expect(result[0].openRate).toBe(42.86);
    // 1/7 = 14.285...% → rounded to 14.29
    expect(result[0].replyRate).toBe(14.29);
  });

  it("handles zero opens and replies", () => {
    const rows: RawRow[] = [row("cold", 50, 0, 0)];
    const result = toCorrelationRows(rows);
    expect(result[0].openRate).toBe(0);
    expect(result[0].replyRate).toBe(0);
  });

  it("returns empty array for empty input", () => {
    expect(toCorrelationRows([])).toEqual([]);
  });

  it("returns empty array when all rows below threshold", () => {
    const rows: RawRow[] = [row("a", 1, 1, 1), row("b", 4, 2, 0)];
    expect(toCorrelationRows(rows)).toEqual([]);
  });

  it("handles large numbers correctly", () => {
    const rows: RawRow[] = [row("big", 10000, 5000, 200)];
    const result = toCorrelationRows(rows);
    expect(result[0].sent).toBe(10000);
    expect(result[0].opened).toBe(5000);
    expect(result[0].replied).toBe(200);
    expect(result[0].openRate).toBe(50);
    expect(result[0].replyRate).toBe(2);
  });
});

// ─── Positive reply filtering scenarios ─────────────────

describe("positive reply filtering — real-world scenarios", () => {
  it("provocative subject generating 'stop emailing me' replies is NOT counted as successful", () => {
    // Scenario: 10 people replied, but 8 said "stop" (interest=2), only 2 positive (interest=7)
    const replies = Array.from({ length: 10 }, (_, i) => ({
      replyCount: 1,
      replyAiInterest: i < 2 ? 7 : 2,
    }));

    const positiveCount = replies.filter(
      (r) => isPositiveReply(r.replyCount, r.replyAiInterest),
    ).length;

    // Only 2 positive replies, not 10
    expect(positiveCount).toBe(2);
  });

  it("campaign with no reply classification falls back to counting all replies", () => {
    const replies = [
      { replyCount: 1, replyAiInterest: null },
      { replyCount: 1, replyAiInterest: null },
      { replyCount: 0, replyAiInterest: null },
    ];

    const positiveCount = replies.filter(
      (r) => isPositiveReply(r.replyCount, r.replyAiInterest),
    ).length;

    // All replies counted (graceful degradation)
    expect(positiveCount).toBe(2);
  });

  it("mixed campaign: classified + unclassified replies handled correctly", () => {
    const replies = [
      { replyCount: 1, replyAiInterest: null },   // unclassified → positive
      { replyCount: 1, replyAiInterest: 8 },      // interested → positive
      { replyCount: 1, replyAiInterest: 2 },      // "stop" → negative
      { replyCount: 1, replyAiInterest: 5 },      // neutral → positive
      { replyCount: 0, replyAiInterest: null },   // no reply → not counted
    ];

    const positiveCount = replies.filter(
      (r) => isPositiveReply(r.replyCount, r.replyAiInterest),
    ).length;

    expect(positiveCount).toBe(3);
  });

  it("spam complaint cascade (multiple interest=1) all excluded", () => {
    const replies = Array.from({ length: 5 }, () => ({
      replyCount: 1,
      replyAiInterest: 1,
    }));

    const positiveCount = replies.filter(
      (r) => isPositiveReply(r.replyCount, r.replyAiInterest),
    ).length;

    expect(positiveCount).toBe(0);
  });

  it("high-quality campaign: all replies are positive", () => {
    const replies = [
      { replyCount: 1, replyAiInterest: 7 },
      { replyCount: 1, replyAiInterest: 9 },
      { replyCount: 1, replyAiInterest: 10 },
    ];

    const positiveCount = replies.filter(
      (r) => isPositiveReply(r.replyCount, r.replyAiInterest),
    ).length;

    expect(positiveCount).toBe(3);
  });
});

// ─── getSubjectForVariant (pure logic) ──────────────────

/** Helper to create RawVariantRow with BigInt values */
function variantRow(variantIndex: number, sent: number, opened: number, replied: number): RawVariantRow {
  return { variantIndex, sent: BigInt(sent), opened: BigInt(opened), replied: BigInt(replied) };
}

describe("getSubjectForVariant", () => {
  it("returns primary subject for index 0", () => {
    expect(getSubjectForVariant(0, "Hey {{name}}", ["Alt 1", "Alt 2"])).toBe("Hey {{name}}");
  });

  it("returns variant subject for index 1", () => {
    expect(getSubjectForVariant(1, "Primary", ["Variant A", "Variant B"])).toBe("Variant A");
  });

  it("returns variant subject for index 2", () => {
    expect(getSubjectForVariant(2, "Primary", ["Variant A", "Variant B"])).toBe("Variant B");
  });

  it("falls back to 'Primary' when primarySubject is null and index is 0", () => {
    expect(getSubjectForVariant(0, null, null)).toBe("Primary");
  });

  it("falls back to 'Variant N' when variants array is null", () => {
    expect(getSubjectForVariant(1, "Primary", null)).toBe("Variant 2");
    expect(getSubjectForVariant(2, "Primary", null)).toBe("Variant 3");
  });

  it("falls back to 'Variant N' when index exceeds variants array", () => {
    expect(getSubjectForVariant(3, "Primary", ["A", "B"])).toBe("Variant 4");
  });

  it("falls back to 'Variant N' when variants is empty array", () => {
    expect(getSubjectForVariant(1, "Primary", [])).toBe("Variant 2");
  });
});

// ─── toVariantPerformanceRows (pure logic) ──────────────

describe("toVariantPerformanceRows", () => {
  const primarySubject = "Quick question about {{company}}";
  const variants = ["Thought about {{company}}", "3 ideas for {{company}}"];

  it("converts raw rows to VariantPerformanceRow with correct rates", () => {
    const rows: RawVariantRow[] = [
      variantRow(0, 100, 30, 5),
      variantRow(1, 80, 20, 3),
      variantRow(2, 90, 40, 8),
    ];
    const result = toVariantPerformanceRows(rows, primarySubject, variants);
    expect(result).toHaveLength(3);

    expect(result[0].variantIndex).toBe(0);
    expect(result[0].subject).toBe(primarySubject);
    expect(result[0].sent).toBe(100);
    expect(result[0].openRate).toBe(30);
    expect(result[0].replyRate).toBe(5);

    expect(result[1].variantIndex).toBe(1);
    expect(result[1].subject).toBe("Thought about {{company}}");

    expect(result[2].variantIndex).toBe(2);
    expect(result[2].subject).toBe("3 ideas for {{company}}");
    expect(result[2].openRate).toBe(44.44);
    expect(result[2].replyRate).toBe(8.89);
  });

  it("filters out variants with < 5 sent", () => {
    const rows: RawVariantRow[] = [
      variantRow(0, 50, 15, 3),
      variantRow(1, 4, 2, 1),  // below threshold
      variantRow(2, 5, 2, 0),  // exactly at threshold
    ];
    const result = toVariantPerformanceRows(rows, primarySubject, variants);
    expect(result).toHaveLength(2);
    expect(result[0].variantIndex).toBe(0);
    expect(result[1].variantIndex).toBe(2);
  });

  it("returns empty array for empty input", () => {
    expect(toVariantPerformanceRows([], primarySubject, variants)).toEqual([]);
  });

  it("returns empty array when all rows below threshold", () => {
    const rows: RawVariantRow[] = [
      variantRow(0, 3, 1, 0),
      variantRow(1, 4, 2, 1),
    ];
    expect(toVariantPerformanceRows(rows, primarySubject, variants)).toEqual([]);
  });

  it("handles null primary subject and variants gracefully", () => {
    const rows: RawVariantRow[] = [
      variantRow(0, 20, 5, 1),
      variantRow(1, 15, 3, 0),
    ];
    const result = toVariantPerformanceRows(rows, null, null);
    expect(result[0].subject).toBe("Primary");
    expect(result[1].subject).toBe("Variant 2");
  });

  it("handles single variant correctly", () => {
    const rows: RawVariantRow[] = [variantRow(0, 200, 60, 12)];
    const result = toVariantPerformanceRows(rows, "Test subject", null);
    expect(result).toHaveLength(1);
    expect(result[0].subject).toBe("Test subject");
    expect(result[0].openRate).toBe(30);
    expect(result[0].replyRate).toBe(6);
  });

  it("computes rates with correct 2-decimal precision", () => {
    const rows: RawVariantRow[] = [variantRow(0, 7, 3, 1)];
    const result = toVariantPerformanceRows(rows, "Subj", []);
    // 3/7 = 42.857...% → 42.86
    expect(result[0].openRate).toBe(42.86);
    // 1/7 = 14.285...% → 14.29
    expect(result[0].replyRate).toBe(14.29);
  });

  it("identifies winner variant by reply rate", () => {
    const rows: RawVariantRow[] = [
      variantRow(0, 100, 20, 2),   // 2% reply
      variantRow(1, 100, 35, 8),   // 8% reply — winner
      variantRow(2, 100, 25, 4),   // 4% reply
    ];
    const result = toVariantPerformanceRows(rows, "Primary", ["Winner Q", "Mid Q"]);
    const sorted = [...result].sort((a, b) => b.replyRate - a.replyRate);
    expect(sorted[0].subject).toBe("Winner Q");
    expect(sorted[0].replyRate).toBe(8);
  });
});
