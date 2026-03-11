import { describe, it, expect } from "vitest";
import { resolveVariantSubject } from "@/server/lib/email/style-learner";
import { buildWinningSubjectsSection } from "@/server/lib/email/prompt-builder";
import type { WinningSubject } from "@/server/lib/email/prompt-builder";

// ─── resolveVariantSubject ─────────────────────────────

describe("resolveVariantSubject", () => {
  const primary = "quick question about pipeline";
  const variants = ["noticed your hiring push", "idea for your team"];

  it("returns primary when variantIndex is null", () => {
    expect(resolveVariantSubject(primary, variants, null)).toBe(primary);
  });

  it("returns primary when variantIndex is 0", () => {
    expect(resolveVariantSubject(primary, variants, 0)).toBe(primary);
  });

  it("returns first variant when variantIndex is 1", () => {
    expect(resolveVariantSubject(primary, variants, 1)).toBe("noticed your hiring push");
  });

  it("returns second variant when variantIndex is 2", () => {
    expect(resolveVariantSubject(primary, variants, 2)).toBe("idea for your team");
  });

  it("falls back to primary when variantIndex is out of range", () => {
    expect(resolveVariantSubject(primary, variants, 5)).toBe(primary);
  });

  it("falls back to primary when variants is null", () => {
    expect(resolveVariantSubject(primary, null, 1)).toBe(primary);
  });

  it("falls back to primary when variants is not an array", () => {
    expect(resolveVariantSubject(primary, "not-array", 1)).toBe(primary);
  });

  it("falls back to primary when variants is empty array", () => {
    expect(resolveVariantSubject(primary, [], 1)).toBe(primary);
  });

  it("falls back to primary when variant entry is not a string", () => {
    expect(resolveVariantSubject(primary, [123, null], 1)).toBe(primary);
  });

  it("handles single variant array", () => {
    expect(resolveVariantSubject(primary, ["only one"], 1)).toBe("only one");
    expect(resolveVariantSubject(primary, ["only one"], 2)).toBe(primary);
  });
});

// ─── buildWinningSubjectsSection ───────────────────────

describe("buildWinningSubjectsSection", () => {
  it("returns empty string for empty array", () => {
    expect(buildWinningSubjectsSection([])).toBe("");
  });

  it("formats a single winning subject", () => {
    const subjects: WinningSubject[] = [
      { subject: "quick question about pipeline", pattern: "Question", step: 0, replies: 3 },
    ];
    const result = buildWinningSubjectsSection(subjects);
    expect(result).toContain("WINNING SUBJECTS");
    expect(result).toContain('"quick question about pipeline"');
    expect(result).toContain("Question");
    expect(result).toContain("step 0");
    expect(result).toContain("3 replies");
    expect(result).toContain("INSPIRATION");
  });

  it("formats multiple winning subjects", () => {
    const subjects: WinningSubject[] = [
      { subject: "quick question about pipeline", pattern: "Question", step: 0, replies: 5 },
      { subject: "noticed your hiring push", pattern: "Observation", step: 0, replies: 3 },
      { subject: "idea for your team", pattern: "Curiosity", step: 1, replies: 2 },
    ];
    const result = buildWinningSubjectsSection(subjects);
    expect(result).toContain("quick question about pipeline");
    expect(result).toContain("noticed your hiring push");
    expect(result).toContain("idea for your team");
    // All lines are bullet points
    const lines = result.split("\n").filter((l) => l.startsWith("- "));
    expect(lines).toHaveLength(3);
  });

  it("uses singular 'reply' for count of 1", () => {
    const subjects: WinningSubject[] = [
      { subject: "test subject", pattern: "Direct", step: 2, replies: 1 },
    ];
    const result = buildWinningSubjectsSection(subjects);
    expect(result).toContain("1 reply)");
    expect(result).not.toContain("1 replies");
  });

  it("uses plural 'replies' for count > 1", () => {
    const subjects: WinningSubject[] = [
      { subject: "test subject", pattern: "Direct", step: 2, replies: 7 },
    ];
    const result = buildWinningSubjectsSection(subjects);
    expect(result).toContain("7 replies)");
  });

  it("includes step number", () => {
    const subjects: WinningSubject[] = [
      { subject: "step 3 subject", pattern: "Curiosity", step: 3, replies: 2 },
    ];
    const result = buildWinningSubjectsSection(subjects);
    expect(result).toContain("step 3");
  });

  it("starts with a section header", () => {
    const subjects: WinningSubject[] = [
      { subject: "test", pattern: "Direct", step: 0, replies: 1 },
    ];
    const result = buildWinningSubjectsSection(subjects);
    expect(result).toMatch(/^[\n]*###/);
  });

  it("ends with inspiration guidance", () => {
    const subjects: WinningSubject[] = [
      { subject: "test", pattern: "Direct", step: 0, replies: 1 },
    ];
    const result = buildWinningSubjectsSection(subjects);
    const lastLine = result.trim().split("\n").pop();
    expect(lastLine).toContain("INSPIRATION");
    expect(lastLine).toContain("don't copy verbatim");
  });
});
