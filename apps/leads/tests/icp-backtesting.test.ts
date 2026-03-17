import { describe, it, expect, vi } from "vitest";

// Mock Prisma client + @prisma/client (correlator.ts uses Prisma.sql at module level)
vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@prisma/client", () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    empty: { strings: [""], values: [] },
  },
}));

import { toCorrelationRows, type RawRow } from "@/server/lib/analytics/correlator";

/** Helper to create RawRow with BigInt values */
function row(dimension: string, sent: number, opened: number, replied: number): RawRow {
  return { dimension, sent: BigInt(sent), opened: BigInt(opened), replied: BigInt(replied) };
}

describe("ICP Backtesting — toCorrelationRows", () => {
  it("converts raw rows with rates", () => {
    const rows: RawRow[] = [
      row("9-10", 100, 60, 15),
      row("7-8", 200, 100, 20),
      row("5-6", 50, 20, 2),
    ];
    const result = toCorrelationRows(rows);
    expect(result).toHaveLength(3);
    expect(result[0].dimension).toBe("9-10");
    expect(result[0].replyRate).toBe(15);
    expect(result[0].openRate).toBe(60);
    expect(result[1].replyRate).toBe(10);
    expect(result[2].replyRate).toBe(4);
  });

  it("filters out rows with fewer than 5 sent", () => {
    const rows: RawRow[] = [
      row("9-10", 4, 2, 1),
      row("7-8", 5, 3, 1),
    ];
    const result = toCorrelationRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].dimension).toBe("7-8");
  });

  it("handles zero replied", () => {
    const rows: RawRow[] = [
      row("VP of Sales", 50, 20, 0),
    ];
    const result = toCorrelationRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].replyRate).toBe(0);
    expect(result[0].openRate).toBe(40);
  });

  it("handles empty rows", () => {
    expect(toCorrelationRows([])).toEqual([]);
  });

  it("rounds rates to 2 decimal places", () => {
    const rows: RawRow[] = [
      row("CTO", 30, 7, 3),
    ];
    const result = toCorrelationRows(rows);
    expect(result[0].openRate).toBe(23.33);
    expect(result[0].replyRate).toBe(10);
  });
});

describe("ICP Backtesting — ideal/negative profile logic", () => {
  it("identifies high-performing segments (>= 10% reply rate, >= 20 volume)", () => {
    const rows = [
      { dimension: "VP of Sales", sent: 50, opened: 30, replied: 8, openRate: 60, replyRate: 16 },
      { dimension: "CEO", sent: 30, opened: 15, replied: 1, openRate: 50, replyRate: 3.33 },
      { dimension: "SDR", sent: 25, opened: 10, replied: 0, openRate: 40, replyRate: 0 },
      { dimension: "Intern", sent: 10, opened: 2, replied: 0, openRate: 20, replyRate: 0 },
    ];

    const MIN_VOLUME = 20;
    const idealProfile: string[] = [];
    const negativeProfile: string[] = [];

    for (const row of rows) {
      if (row.sent >= MIN_VOLUME && row.replyRate >= 10) {
        idealProfile.push(`${row.dimension} (${row.replyRate}% reply rate, ${row.sent} sent)`);
      }
      if (row.sent >= MIN_VOLUME && row.replyRate === 0) {
        negativeProfile.push(`${row.dimension} (0% reply rate, ${row.sent} sent)`);
      }
    }

    expect(idealProfile).toEqual(["VP of Sales (16% reply rate, 50 sent)"]);
    expect(negativeProfile).toEqual(["SDR (0% reply rate, 25 sent)"]);
  });
});
