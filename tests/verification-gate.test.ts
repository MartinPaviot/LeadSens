import { describe, it, expect } from "vitest";
import { checkVerificationGate } from "@/server/lib/tools/instantly-tools";

describe("checkVerificationGate", () => {
  // ─── No verifier connected (graceful degradation) ─────────
  it("passes through when no verifier is connected", () => {
    const leads = [
      { verificationStatus: null },
      { verificationStatus: null },
    ];
    const result = checkVerificationGate(leads, false);
    expect(result.canPush).toBe(true);
    expect(result.warning).toBeUndefined();
    expect(result.unverifiedCount).toBe(0);
    expect(result.invalidCount).toBe(0);
  });

  it("passes through with empty leads array", () => {
    const result = checkVerificationGate([], true);
    expect(result.canPush).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  // ─── All leads verified as valid ──────────────────────────
  it("passes when all leads are verified as valid", () => {
    const leads = [
      { verificationStatus: "valid" },
      { verificationStatus: "valid" },
      { verificationStatus: "valid" },
    ];
    const result = checkVerificationGate(leads, true);
    expect(result.canPush).toBe(true);
    expect(result.warning).toBeUndefined();
    expect(result.unverifiedCount).toBe(0);
    expect(result.invalidCount).toBe(0);
  });

  // ─── Mixed valid + catch_all (no warning) ──────────────────
  it("passes with valid + catch_all leads (no warning)", () => {
    const leads = [
      { verificationStatus: "valid" },
      { verificationStatus: "catch_all" },
      { verificationStatus: "valid" },
    ];
    const result = checkVerificationGate(leads, true);
    expect(result.canPush).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  // ─── Unverified leads → warning ───────────────────────────
  it("warns when some leads are unverified", () => {
    const leads = [
      { verificationStatus: "valid" },
      { verificationStatus: null },
      { verificationStatus: null },
    ];
    const result = checkVerificationGate(leads, true);
    expect(result.canPush).toBe(true);
    expect(result.warning).toContain("2/3 leads not verified");
    expect(result.unverifiedCount).toBe(2);
    expect(result.invalidCount).toBe(0);
  });

  it("warns when all leads are unverified", () => {
    const leads = [
      { verificationStatus: null },
      { verificationStatus: null },
      { verificationStatus: null },
    ];
    const result = checkVerificationGate(leads, true);
    expect(result.canPush).toBe(true);
    expect(result.warning).toContain("3/3 leads not verified");
    expect(result.unverifiedCount).toBe(3);
  });

  // ─── Invalid leads > 5% → block ──────────────────────────
  it("blocks when >5% of leads have invalid emails", () => {
    // 2 out of 10 = 20% invalid → block
    const leads = [
      { verificationStatus: "invalid" },
      { verificationStatus: "spamtrap" },
      ...Array(8).fill(null).map(() => ({ verificationStatus: "valid" })),
    ];
    const result = checkVerificationGate(leads, true);
    expect(result.canPush).toBe(false);
    expect(result.warning).toContain("2/10 leads");
    expect(result.warning).toContain("20%");
    expect(result.invalidCount).toBe(2);
  });

  it("blocks when exactly at 6% invalid (above 5% threshold)", () => {
    // 6 out of 100 = 6% → block
    const leads = [
      ...Array(6).fill(null).map(() => ({ verificationStatus: "invalid" })),
      ...Array(94).fill(null).map(() => ({ verificationStatus: "valid" })),
    ];
    const result = checkVerificationGate(leads, true);
    expect(result.canPush).toBe(false);
    expect(result.invalidCount).toBe(6);
  });

  it("passes when exactly at 5% invalid (at threshold boundary)", () => {
    // 5 out of 100 = 5% exactly → pass (threshold is >5%, not >=5%)
    const leads = [
      ...Array(5).fill(null).map(() => ({ verificationStatus: "invalid" })),
      ...Array(95).fill(null).map(() => ({ verificationStatus: "valid" })),
    ];
    const result = checkVerificationGate(leads, true);
    expect(result.canPush).toBe(true);
  });

  // ─── All invalid statuses are detected ────────────────────
  it("detects all invalid status types: invalid, spamtrap, abuse, disposable", () => {
    const leads = [
      { verificationStatus: "invalid" },
      { verificationStatus: "spamtrap" },
      { verificationStatus: "abuse" },
      { verificationStatus: "disposable" },
    ];
    const result = checkVerificationGate(leads, true);
    expect(result.canPush).toBe(false);
    expect(result.invalidCount).toBe(4);
  });

  // ─── Edge cases ───────────────────────────────────────────
  it("does not count unknown as invalid", () => {
    const leads = [
      { verificationStatus: "unknown" },
      { verificationStatus: "valid" },
    ];
    const result = checkVerificationGate(leads, true);
    expect(result.canPush).toBe(true);
    expect(result.invalidCount).toBe(0);
  });

  it("does not count catch_all as invalid", () => {
    const leads = [
      { verificationStatus: "catch_all" },
      { verificationStatus: "valid" },
    ];
    const result = checkVerificationGate(leads, true);
    expect(result.canPush).toBe(true);
    expect(result.invalidCount).toBe(0);
  });

  it("handles mix of unverified + invalid (block takes priority)", () => {
    // 3 invalid out of 5 total = 60% → block
    const leads = [
      { verificationStatus: null },
      { verificationStatus: "invalid" },
      { verificationStatus: "invalid" },
      { verificationStatus: "invalid" },
      { verificationStatus: "valid" },
    ];
    const result = checkVerificationGate(leads, true);
    expect(result.canPush).toBe(false);
    expect(result.invalidCount).toBe(3);
    expect(result.unverifiedCount).toBe(1);
  });

  it("warns when few invalid (under 5%) + some unverified", () => {
    // 1 invalid out of 25 = 4% (under threshold) + some unverified
    const leads = [
      { verificationStatus: "invalid" },
      ...Array(4).fill(null).map(() => ({ verificationStatus: null })),
      ...Array(20).fill(null).map(() => ({ verificationStatus: "valid" })),
    ];
    const result = checkVerificationGate(leads, true);
    expect(result.canPush).toBe(true);
    expect(result.warning).toContain("4/25 leads not verified");
    expect(result.invalidCount).toBe(1);
    expect(result.unverifiedCount).toBe(4);
  });

  it("single lead that is invalid → blocks (100%)", () => {
    const leads = [{ verificationStatus: "invalid" }];
    const result = checkVerificationGate(leads, true);
    expect(result.canPush).toBe(false);
    expect(result.invalidCount).toBe(1);
  });

  it("single lead that is unverified → warns", () => {
    const leads = [{ verificationStatus: null }];
    const result = checkVerificationGate(leads, true);
    expect(result.canPush).toBe(true);
    expect(result.warning).toContain("1/1 leads not verified");
  });
});
