import { describe, it, expect, vi } from "vitest";
import { mapRevenueToAPI } from "@/server/lib/connectors/instantly";

/**
 * Revenue mapping completeness — every VALID_REVENUE value from the ICP parser
 * must map to a known Instantly API value without a console warning.
 */

// These are the exact values from icp-parser.ts VALID_REVENUE set
const VALID_REVENUE = [
  "$0 - 1M",
  "$1M - 10M",
  "$10M - 50M",
  "$50M - 100M",
  "$100M - 250M",
  "$250M - 500M",
  "$500M - 1B",
  "> $1B",
];

// Expected API values (from Instantly SuperSearch documentation)
const EXPECTED_API_VALUES = new Set([
  "$0 - 1M",
  "$1 - 10M",
  "$10 - 50M",
  "$50 - 100M",
  "$100 - 250M",
  "$250 - 500M",
  "$500M - 1B",
  "> $1B",
]);

describe("mapRevenueToAPI", () => {
  it("maps every VALID_REVENUE value without warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    for (const value of VALID_REVENUE) {
      const mapped = mapRevenueToAPI(value);
      expect(mapped).toBeTruthy();
      expect(EXPECTED_API_VALUES.has(mapped)).toBe(true);
    }

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("warns on unmapped values", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = mapRevenueToAPI("$999B - Infinity");
    expect(result).toBe("$999B - Infinity"); // pass-through
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("unmapped revenue value");

    warnSpy.mockRestore();
  });

  it("maps $1M - 10M to $1 - 10M (drops M from first number)", () => {
    expect(mapRevenueToAPI("$1M - 10M")).toBe("$1 - 10M");
  });

  it("maps identity values unchanged", () => {
    expect(mapRevenueToAPI("$0 - 1M")).toBe("$0 - 1M");
    expect(mapRevenueToAPI("$500M - 1B")).toBe("$500M - 1B");
    expect(mapRevenueToAPI("> $1B")).toBe("> $1B");
  });
});
