import { describe, it, expect } from "vitest";
import { matchVariantIndex, normalizeSubject } from "@/server/lib/analytics/variant-attribution";

// ─── normalizeSubject ─────────────────────────────────────

describe("normalizeSubject", () => {
  it("lowercases the subject", () => {
    expect(normalizeSubject("Hello World")).toBe("hello world");
  });

  it("trims whitespace", () => {
    expect(normalizeSubject("  hello  ")).toBe("hello");
  });

  it("strips Re: prefix", () => {
    expect(normalizeSubject("Re: Quick question")).toBe("quick question");
  });

  it("strips RE: prefix (uppercase)", () => {
    expect(normalizeSubject("RE: Quick question")).toBe("quick question");
  });

  it("strips Fwd: prefix", () => {
    expect(normalizeSubject("Fwd: Quick question")).toBe("quick question");
  });

  it("strips FW: prefix", () => {
    expect(normalizeSubject("FW: Quick question")).toBe("quick question");
  });

  it("handles empty string", () => {
    expect(normalizeSubject("")).toBe("");
  });

  it("preserves content without prefix", () => {
    expect(normalizeSubject("Quick question about your pipeline")).toBe(
      "quick question about your pipeline",
    );
  });
});

// ─── matchVariantIndex ────────────────────────────────────

describe("matchVariantIndex", () => {
  const primary = "Quick question about Acme Corp";
  const variants = [
    "Noticed your team is growing fast",
    "3 ideas for your outbound strategy",
  ];

  it("returns 0 when sent subject matches primary", () => {
    expect(matchVariantIndex("Quick question about Acme Corp", primary, variants)).toBe(0);
  });

  it("returns 1 when sent subject matches first variant", () => {
    expect(
      matchVariantIndex("Noticed your team is growing fast", primary, variants),
    ).toBe(1);
  });

  it("returns 2 when sent subject matches second variant", () => {
    expect(
      matchVariantIndex("3 ideas for your outbound strategy", primary, variants),
    ).toBe(2);
  });

  it("returns null when sent subject matches nothing", () => {
    expect(
      matchVariantIndex("Completely different subject", primary, variants),
    ).toBeNull();
  });

  it("matches case-insensitively", () => {
    expect(
      matchVariantIndex("QUICK QUESTION ABOUT ACME CORP", primary, variants),
    ).toBe(0);
  });

  it("matches after stripping Re: prefix", () => {
    expect(
      matchVariantIndex("Re: Quick question about Acme Corp", primary, variants),
    ).toBe(0);
  });

  it("matches after stripping Fwd: prefix", () => {
    expect(
      matchVariantIndex("Fwd: Noticed your team is growing fast", primary, variants),
    ).toBe(1);
  });

  it("handles null variants", () => {
    expect(matchVariantIndex("Quick question about Acme Corp", primary, null)).toBe(0);
    expect(matchVariantIndex("Something else", primary, null)).toBeNull();
  });

  it("handles undefined variants", () => {
    expect(matchVariantIndex("Quick question about Acme Corp", primary, undefined)).toBe(0);
    expect(matchVariantIndex("Something else", primary, undefined)).toBeNull();
  });

  it("handles empty variants array", () => {
    expect(matchVariantIndex("Quick question about Acme Corp", primary, [])).toBe(0);
    expect(matchVariantIndex("Something else", primary, [])).toBeNull();
  });

  it("handles whitespace differences", () => {
    expect(
      matchVariantIndex("  Quick question about Acme Corp  ", primary, variants),
    ).toBe(0);
  });

  it("handles mixed case Re: + content", () => {
    expect(
      matchVariantIndex("re: 3 IDEAS FOR YOUR OUTBOUND STRATEGY", primary, variants),
    ).toBe(2);
  });

  it("returns primary (0) before checking variants if both match", () => {
    // Edge case: if variant is same as primary, primary wins
    const sameVariants = ["Quick question about Acme Corp", "Other subject"];
    expect(
      matchVariantIndex("Quick question about Acme Corp", primary, sameVariants),
    ).toBe(0);
  });

  it("handles non-string elements in variants gracefully", () => {
    // Prisma Json? could contain unexpected data
    const weirdVariants = [null, 42, "Valid variant"] as unknown as string[];
    expect(matchVariantIndex("Valid variant", primary, weirdVariants)).toBe(3);
    expect(matchVariantIndex(primary, primary, weirdVariants)).toBe(0);
  });
});
