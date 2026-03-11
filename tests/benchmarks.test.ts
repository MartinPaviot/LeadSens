import { describe, it, expect } from "vitest";
import { findBenchmark, getBenchmarkContext } from "@/server/lib/analytics/benchmarks";

describe("findBenchmark", () => {
  it("finds exact industry match", () => {
    expect(findBenchmark("SaaS")).not.toBeNull();
    expect(findBenchmark("SaaS")?.replyRate).toEqual([8, 12]);
  });

  it("finds case-insensitive match", () => {
    expect(findBenchmark("saas")).not.toBeNull();
    expect(findBenchmark("SAAS")).not.toBeNull();
  });

  it("finds substring match", () => {
    expect(findBenchmark("B2B SaaS platform")).not.toBeNull();
    expect(findBenchmark("Healthcare IT")).not.toBeNull();
  });

  it("finds via aliases", () => {
    expect(findBenchmark("software")).not.toBeNull();
    expect(findBenchmark("banking")).not.toBeNull();
    expect(findBenchmark("artificial intelligence")).not.toBeNull();
    expect(findBenchmark("staffing")).not.toBeNull();
  });

  it("returns null for unknown industry", () => {
    expect(findBenchmark("underwater basket weaving")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(findBenchmark(null)).toBeNull();
    expect(findBenchmark(undefined)).toBeNull();
  });
});

describe("getBenchmarkContext", () => {
  it("returns 'below' for low reply rate", () => {
    const ctx = getBenchmarkContext("SaaS", 3.0);
    expect(ctx).toContain("below");
    expect(ctx).toContain("8-12%");
  });

  it("returns 'within' for average reply rate", () => {
    const ctx = getBenchmarkContext("SaaS", 10.0);
    expect(ctx).toContain("within");
  });

  it("returns 'exceeds' for high reply rate", () => {
    const ctx = getBenchmarkContext("SaaS", 15.0);
    expect(ctx).toContain("exceeds");
  });

  it("returns null for unknown industry", () => {
    expect(getBenchmarkContext("unknown", 10.0)).toBeNull();
  });

  it("returns null for null industry", () => {
    expect(getBenchmarkContext(null, 10.0)).toBeNull();
  });
});
