import { describe, it, expect } from "vitest";
import { rankPatternsByThompson, formatPatternRanking } from "@/server/lib/analytics/thompson-sampling";

describe("rankPatternsByThompson", () => {
  it("returns empty array for empty input", () => {
    expect(rankPatternsByThompson([])).toEqual([]);
  });

  it("returns valid scores in [0, 1]", () => {
    const patterns = [
      { name: "Question", sent: 100, replied: 12 },
      { name: "Observation", sent: 80, replied: 6 },
      { name: "Curiosity", sent: 50, replied: 3 },
    ];
    const ranked = rankPatternsByThompson(patterns);
    expect(ranked).toHaveLength(3);
    for (const r of ranked) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  it("sorted descending by score", () => {
    const patterns = [
      { name: "A", sent: 100, replied: 50 },
      { name: "B", sent: 100, replied: 1 },
    ];
    const ranked = rankPatternsByThompson(patterns);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });

  it("high-performer tends to rank first over many runs", () => {
    const patterns = [
      { name: "Winner", sent: 200, replied: 40 },
      { name: "Loser", sent: 200, replied: 2 },
    ];

    let winnerFirst = 0;
    const runs = 100;
    for (let i = 0; i < runs; i++) {
      const ranked = rankPatternsByThompson(patterns);
      if (ranked[0].name === "Winner") winnerFirst++;
    }

    // Winner should rank first >80% of the time with these stats
    expect(winnerFirst).toBeGreaterThan(80);
  });

  it("explores patterns with few data points", () => {
    const patterns = [
      { name: "Established", sent: 500, replied: 40 },
      { name: "New", sent: 5, replied: 1 },
    ];

    let newFirst = 0;
    const runs = 1000;
    for (let i = 0; i < runs; i++) {
      const ranked = rankPatternsByThompson(patterns);
      if (ranked[0].name === "New") newFirst++;
    }

    // New pattern should sometimes rank first (exploration)
    // With only 5 sends, Beta posterior is very wide → high exploration rate expected
    expect(newFirst).toBeGreaterThan(0);
    expect(newFirst).toBeLessThan(990);
  });
});

describe("formatPatternRanking", () => {
  it("returns empty string with insufficient data", () => {
    expect(formatPatternRanking([])).toBe("");
    expect(formatPatternRanking([{ name: "A", sent: 5, replied: 1 }])).toBe("");
  });

  it("returns empty string below minTotalSent", () => {
    const patterns = [
      { name: "A", sent: 10, replied: 2 },
      { name: "B", sent: 10, replied: 1 },
    ];
    expect(formatPatternRanking(patterns, 50)).toBe("");
  });

  it("returns formatted string with sufficient data", () => {
    const patterns = [
      { name: "Question", sent: 100, replied: 12 },
      { name: "Observation", sent: 80, replied: 6 },
      { name: "Curiosity", sent: 50, replied: 3 },
    ];
    const result = formatPatternRanking(patterns);
    expect(result).toContain("SUBJECT LINE PATTERNS");
    expect(result).toContain("Question");
    expect(result).toContain("Observation");
    expect(result).toContain("Curiosity");
    expect(result).toContain("★");
    expect(result).toContain("Use patterns 1, 2, 3");
  });
});
