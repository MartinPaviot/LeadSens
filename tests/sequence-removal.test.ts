import { describe, it, expect } from "vitest";
import { mapToInstantlyInterestStatus } from "@/server/lib/tools/pipeline-tools";

// ─── mapToInstantlyInterestStatus (pure mapping) ────────

describe("mapToInstantlyInterestStatus", () => {
  it("maps INTERESTED to Instantly interest status 1", () => {
    expect(mapToInstantlyInterestStatus("INTERESTED")).toBe(1);
  });

  it("maps NOT_INTERESTED to Instantly interest status -1", () => {
    expect(mapToInstantlyInterestStatus("NOT_INTERESTED")).toBe(-1);
  });

  it("maps MEETING_BOOKED to Instantly interest status 2", () => {
    expect(mapToInstantlyInterestStatus("MEETING_BOOKED")).toBe(2);
  });
});

// ─── Mapping correctness vs Instantly API §4.2 ─────────

describe("mapping matches Instantly API §4.2 enum values", () => {
  // Instantly API §4.2:
  // 0 = Out of Office, 1 = Interested, 2 = Meeting Booked,
  // 3 = Meeting Completed, 4 = Won,
  // -1 = Not Interested, -2 = Wrong Person, -3 = Lost, -4 = No Show

  it("INTERESTED → 1 matches Instantly 'Interested'", () => {
    expect(mapToInstantlyInterestStatus("INTERESTED")).toBe(1);
  });

  it("NOT_INTERESTED → -1 matches Instantly 'Not Interested'", () => {
    expect(mapToInstantlyInterestStatus("NOT_INTERESTED")).toBe(-1);
  });

  it("MEETING_BOOKED → 2 matches Instantly 'Meeting Booked'", () => {
    expect(mapToInstantlyInterestStatus("MEETING_BOOKED")).toBe(2);
  });

  it("all three statuses map to distinct values", () => {
    const values = [
      mapToInstantlyInterestStatus("INTERESTED"),
      mapToInstantlyInterestStatus("NOT_INTERESTED"),
      mapToInstantlyInterestStatus("MEETING_BOOKED"),
    ];
    const unique = new Set(values);
    expect(unique.size).toBe(3);
  });

  it("no status maps to 0 (Out of Office)", () => {
    const values = [
      mapToInstantlyInterestStatus("INTERESTED"),
      mapToInstantlyInterestStatus("NOT_INTERESTED"),
      mapToInstantlyInterestStatus("MEETING_BOOKED"),
    ];
    expect(values).not.toContain(0);
  });
});

// ─── Coverage of all LeadSens terminal statuses ─────────

describe("all LeadSens terminal statuses are mapped", () => {
  const terminalStatuses = ["INTERESTED", "NOT_INTERESTED", "MEETING_BOOKED"] as const;

  for (const status of terminalStatuses) {
    it(`${status} produces a valid Instantly interest status number`, () => {
      const result = mapToInstantlyInterestStatus(status);
      expect(typeof result).toBe("number");
      // Instantly interest statuses range from -4 to 4
      expect(result).toBeGreaterThanOrEqual(-4);
      expect(result).toBeLessThanOrEqual(4);
    });
  }
});
