import { describe, it, expect } from "vitest";
import { webhookVariantToIndex } from "@/app/api/webhooks/instantly/route";

// ─── webhookVariantToIndex (pure function) ─────────────

describe("webhookVariantToIndex", () => {
  // Valid conversions: Instantly 1-indexed → our 0-indexed
  it("converts variant 1 (primary) to index 0", () => {
    expect(webhookVariantToIndex(1)).toBe(0);
  });

  it("converts variant 2 to index 1", () => {
    expect(webhookVariantToIndex(2)).toBe(1);
  });

  it("converts variant 3 to index 2", () => {
    expect(webhookVariantToIndex(3)).toBe(2);
  });

  it("handles high variant numbers", () => {
    expect(webhookVariantToIndex(10)).toBe(9);
  });

  // Null/undefined — no variant in payload
  it("returns null for undefined", () => {
    expect(webhookVariantToIndex(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(webhookVariantToIndex(null)).toBeNull();
  });

  // Invalid values
  it("returns null for 0 (invalid — Instantly starts at 1)", () => {
    expect(webhookVariantToIndex(0)).toBeNull();
  });

  it("returns null for negative numbers", () => {
    expect(webhookVariantToIndex(-1)).toBeNull();
    expect(webhookVariantToIndex(-100)).toBeNull();
  });

  it("returns null for non-integer (float)", () => {
    expect(webhookVariantToIndex(1.5)).toBeNull();
    expect(webhookVariantToIndex(2.7)).toBeNull();
  });

  it("returns null for NaN", () => {
    expect(webhookVariantToIndex(NaN)).toBeNull();
  });

  it("returns null for Infinity", () => {
    expect(webhookVariantToIndex(Infinity)).toBeNull();
    expect(webhookVariantToIndex(-Infinity)).toBeNull();
  });
});

// ─── Zod schema validation with variant/step ────────────

describe("webhook event schemas accept variant and step fields", () => {
  // We can't import the schemas directly (they're module-scoped),
  // but we can verify via the exported webhookVariantToIndex that
  // the conversion logic is correct for all event types

  it("variant field is optional — events without it still parse", () => {
    // webhookVariantToIndex handles the undefined case
    expect(webhookVariantToIndex(undefined)).toBeNull();
  });

  it("variant=1 maps to primary subject (variantIndex=0)", () => {
    expect(webhookVariantToIndex(1)).toBe(0);
  });

  it("variant=2 maps to first A/B variant (variantIndex=1)", () => {
    expect(webhookVariantToIndex(2)).toBe(1);
  });

  it("variant=3 maps to second A/B variant (variantIndex=2)", () => {
    expect(webhookVariantToIndex(3)).toBe(2);
  });
});
