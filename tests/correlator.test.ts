import { describe, it, expect } from "vitest";
import {
  isPositiveReply,
  toCorrelationRows,
  POSITIVE_REPLY_INTEREST_THRESHOLD,
  type RawRow,
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
