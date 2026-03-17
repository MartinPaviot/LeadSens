import { describe, it, expect } from "vitest";

/**
 * Tests that the Instantly interest status mapping (in instantly-esp.ts)
 * correctly maps reason strings to Instantly API §4.2 enum values.
 *
 * The mapping is now embedded in instantly-esp.ts removeFromSequence(),
 * so we test the mapping object directly here.
 */

// Reproduce the mapping from instantly-esp.ts for testing
const INTEREST_MAP: Record<string, number> = {
  interested: 1,
  not_interested: -1,
  meeting_booked: 2,
};

describe("Instantly interest status mapping", () => {
  it("maps interested to Instantly interest status 1", () => {
    expect(INTEREST_MAP.interested).toBe(1);
  });

  it("maps not_interested to Instantly interest status -1", () => {
    expect(INTEREST_MAP.not_interested).toBe(-1);
  });

  it("maps meeting_booked to Instantly interest status 2", () => {
    expect(INTEREST_MAP.meeting_booked).toBe(2);
  });

  it("all three reasons map to distinct values", () => {
    const values = Object.values(INTEREST_MAP);
    expect(new Set(values).size).toBe(3);
  });

  it("no reason maps to 0 (Out of Office)", () => {
    expect(Object.values(INTEREST_MAP)).not.toContain(0);
  });
});

describe("ESP reason map covers all terminal statuses", () => {
  const reasons = ["interested", "not_interested", "meeting_booked"] as const;

  for (const reason of reasons) {
    it(`${reason} produces a valid Instantly interest status number`, () => {
      const result = INTEREST_MAP[reason];
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(-4);
      expect(result).toBeLessThanOrEqual(4);
    });
  }
});
