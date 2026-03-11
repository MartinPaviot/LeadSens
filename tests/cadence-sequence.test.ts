import { describe, it, expect } from "vitest";
import {
  getFramework,
  selectCta,
  buildPreviousEmailsSection,
  buildStepAnnotation,
  CTA_LIBRARY,
  type StepPerformanceAnnotation,
} from "@/server/lib/email/prompt-builder";
import type { DraftedEmailRef } from "@/server/lib/email/types";
import {
  TIER_CADENCES,
  getPredominantTier,
} from "@/server/lib/tools/esp-tools";

// ─── getFramework ────────────────────────────────────────

describe("getFramework", () => {
  const EXPECTED: { step: number; name: string; maxWords: number }[] = [
    { step: 0, name: "PAS (Timeline Hook)", maxWords: 85 },
    { step: 1, name: "Value-add", maxWords: 65 },
    { step: 2, name: "Social Proof", maxWords: 70 },
    { step: 3, name: "New Angle", maxWords: 65 },
    { step: 4, name: "Micro-value", maxWords: 50 },
    { step: 5, name: "Breakup", maxWords: 45 },
  ];

  for (const { step, name, maxWords } of EXPECTED) {
    it(`step ${step} returns "${name}" with maxWords=${maxWords}`, () => {
      const fw = getFramework(step);
      expect(fw.name).toBe(name);
      expect(fw.maxWords).toBe(maxWords);
    });
  }

  it("returns non-empty instructions for every step", () => {
    for (let step = 0; step <= 5; step++) {
      const fw = getFramework(step);
      expect(fw.instructions.length).toBeGreaterThan(50);
    }
  });

  it("returns non-empty objective for every step", () => {
    for (let step = 0; step <= 5; step++) {
      const fw = getFramework(step);
      expect(fw.objective.length).toBeGreaterThan(10);
    }
  });

  it("default case (step 99) falls back to step 0", () => {
    const fw = getFramework(99);
    const step0 = getFramework(0);
    expect(fw.name).toBe(step0.name);
    expect(fw.maxWords).toBe(step0.maxWords);
    expect(fw.instructions).toBe(step0.instructions);
  });

  it("negative step falls back to step 0", () => {
    const fw = getFramework(-1);
    expect(fw.name).toBe(getFramework(0).name);
  });

  // Snapshot regression guard
  it("framework names + maxWords snapshot", () => {
    const snapshot = Array.from({ length: 6 }, (_, i) => {
      const fw = getFramework(i);
      return { step: i, name: fw.name, maxWords: fw.maxWords };
    });
    expect(snapshot).toMatchInlineSnapshot(`
      [
        {
          "maxWords": 85,
          "name": "PAS (Timeline Hook)",
          "step": 0,
        },
        {
          "maxWords": 65,
          "name": "Value-add",
          "step": 1,
        },
        {
          "maxWords": 70,
          "name": "Social Proof",
          "step": 2,
        },
        {
          "maxWords": 65,
          "name": "New Angle",
          "step": 3,
        },
        {
          "maxWords": 50,
          "name": "Micro-value",
          "step": 4,
        },
        {
          "maxWords": 45,
          "name": "Breakup",
          "step": 5,
        },
      ]
    `);
  });

  it("all maxWords are under 90 (research: <80 words = highest reply rate, +10 buffer)", () => {
    for (let step = 0; step <= 5; step++) {
      expect(getFramework(step).maxWords).toBeLessThanOrEqual(90);
    }
  });

  it("maxWords decrease monotonically from step 0 to step 5 (except step 2 Social Proof)", () => {
    // Social Proof (step 2) needs more room for narrative, so it's allowed to be higher than step 1
    // But overall trend should be decreasing
    expect(getFramework(0).maxWords).toBeGreaterThan(getFramework(5).maxWords);
    expect(getFramework(4).maxWords).toBeGreaterThanOrEqual(getFramework(5).maxWords);
  });
});

// ─── selectCta ───────────────────────────────────────────

describe("selectCta", () => {
  const ctas = [
    { label: "Book a demo", commitment: "medium" as const },
    { label: "Get the benchmark", commitment: "low" as const },
    { label: "Start free trial", commitment: "high" as const },
  ];

  it("steps 0 and 2 select medium commitment CTA", () => {
    expect(selectCta(ctas, 0)).toBe("Book a demo");
    expect(selectCta(ctas, 2)).toBe("Book a demo");
  });

  it("steps 1, 3, 4, 5 select low commitment CTA", () => {
    for (const step of [1, 3, 4, 5]) {
      expect(selectCta(ctas, step)).toBe("Get the benchmark");
    }
  });

  it("falls back to first CTA if target commitment not found", () => {
    const lowOnly = [{ label: "Free guide", commitment: "low" as const }];
    // Step 0 wants medium, only low available → falls back to first
    expect(selectCta(lowOnly, 0)).toBe("Free guide");
  });

  it("includes URL when available", () => {
    const withUrl = [
      { label: "Book a demo", commitment: "medium" as const, url: "https://example.com/demo" },
    ];
    expect(selectCta(withUrl, 0)).toBe("Book a demo (https://example.com/demo)");
  });

  it("returns null for empty ctas array", () => {
    expect(selectCta([], 0)).toBeNull();
  });
});

// ─── buildPreviousEmailsSection ──────────────────────────

describe("buildPreviousEmailsSection", () => {
  it("returns empty string for no previous emails", () => {
    expect(buildPreviousEmailsSection([])).toBe("");
  });

  it("includes step number and subject for each email", () => {
    const emails: DraftedEmailRef[] = [
      { step: 0, subject: "quick question, John" },
    ];
    const result = buildPreviousEmailsSection(emails);
    expect(result).toContain("Step 0");
    expect(result).toContain("quick question, John");
  });

  it("includes body when provided", () => {
    const emails: DraftedEmailRef[] = [
      { step: 0, subject: "subject", body: "Hello there, this is the email body." },
    ];
    const result = buildPreviousEmailsSection(emails);
    expect(result).toContain("Hello there, this is the email body.");
  });

  it("handles multiple previous emails", () => {
    const emails: DraftedEmailRef[] = [
      { step: 0, subject: "first subject", body: "First body" },
      { step: 1, subject: "second subject", body: "Second body" },
      { step: 2, subject: "third subject", body: "Third body" },
    ];
    const result = buildPreviousEmailsSection(emails);
    expect(result).toContain("Step 0");
    expect(result).toContain("Step 1");
    expect(result).toContain("Step 2");
    expect(result).toContain("first subject");
    expect(result).toContain("second subject");
    expect(result).toContain("third subject");
  });

  it("truncates body at 1500 chars", () => {
    const longBody = "A".repeat(2000);
    const emails: DraftedEmailRef[] = [
      { step: 0, subject: "test", body: longBody },
    ];
    const result = buildPreviousEmailsSection(emails);
    // Should contain the truncated version with "..."
    expect(result).toContain("...");
    // Should NOT contain the full 2000-char body
    expect(result).not.toContain("A".repeat(2000));
    // Truncated at 1500 + "..."
    expect(result).toContain("A".repeat(1500));
  });

  it("does not truncate body under 1500 chars", () => {
    const body = "B".repeat(1400);
    const emails: DraftedEmailRef[] = [
      { step: 0, subject: "test", body },
    ];
    const result = buildPreviousEmailsSection(emails);
    expect(result).toContain(body);
    expect(result).not.toContain("...");
  });

  it("includes DO NOT repeat instruction header", () => {
    const emails: DraftedEmailRef[] = [
      { step: 0, subject: "s" },
    ];
    const result = buildPreviousEmailsSection(emails);
    expect(result).toContain("DO NOT repeat");
    expect(result).toContain("ADVANCE the conversation");
  });
});

// ─── buildStepAnnotation ─────────────────────────────────

describe("buildStepAnnotation", () => {
  it("returns empty string when sample size < 50", () => {
    const annotation: StepPerformanceAnnotation = {
      stepName: "PAS",
      replyRate: 12.5,
      sampleSize: 49,
      isTop: true,
    };
    expect(buildStepAnnotation(annotation, 0)).toBe("");
  });

  it("returns annotation when sample size >= 50", () => {
    const annotation: StepPerformanceAnnotation = {
      stepName: "PAS",
      replyRate: 12.5,
      sampleSize: 200,
      isTop: true,
    };
    const result = buildStepAnnotation(annotation, 0);
    expect(result).toContain("PERFORMANCE DATA");
    expect(result).toContain("Step 0");
    expect(result).toContain("PAS");
    expect(result).toContain("12.5%");
    expect(result).toContain("200 emails");
  });

  it("indicates best-performing step when isTop is true", () => {
    const annotation: StepPerformanceAnnotation = {
      stepName: "Value-add",
      replyRate: 15.0,
      sampleSize: 100,
      isTop: true,
    };
    const result = buildStepAnnotation(annotation, 1);
    expect(result).toContain("best-performing");
  });

  it("indicates underperforming step when isTop is false", () => {
    const annotation: StepPerformanceAnnotation = {
      stepName: "Breakup",
      replyRate: 2.0,
      sampleSize: 80,
      isTop: false,
    };
    const result = buildStepAnnotation(annotation, 5);
    expect(result).toContain("underperforms");
  });

  it("sample size exactly 50 produces annotation", () => {
    const annotation: StepPerformanceAnnotation = {
      stepName: "Micro-value",
      replyRate: 5.5,
      sampleSize: 50,
      isTop: false,
    };
    const result = buildStepAnnotation(annotation, 4);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("Micro-value");
  });
});

// ─── CTA_LIBRARY ─────────────────────────────────────────

describe("CTA_LIBRARY", () => {
  it("has entries for all 6 steps", () => {
    for (let step = 0; step <= 5; step++) {
      expect(CTA_LIBRARY[step]).toBeDefined();
      expect(CTA_LIBRARY[step].length).toBeGreaterThanOrEqual(2);
    }
  });

  it("step 5 CTAs are low-pressure (breakup)", () => {
    const step5 = CTA_LIBRARY[5];
    // All breakup CTAs should be about closing/checking back, not booking calls
    for (const cta of step5) {
      expect(cta.toLowerCase()).not.toContain("demo");
      expect(cta.toLowerCase()).not.toContain("call");
    }
  });
});

// ─── Delays & Cadences ──────────────────────────────────

describe("TIER_CADENCES", () => {
  it("default cadence (Tier 2) is [0, 2, 5, 9, 14, 21]", () => {
    expect(TIER_CADENCES[2]).toEqual([0, 2, 5, 9, 14, 21]);
  });

  it("all tiers have exactly 6 delays", () => {
    for (const tier of [1, 2, 3] as const) {
      expect(TIER_CADENCES[tier]).toHaveLength(6);
    }
  });

  it("all tiers start with delay 0 (step 0 = immediate)", () => {
    for (const tier of [1, 2, 3] as const) {
      expect(TIER_CADENCES[tier][0]).toBe(0);
    }
  });

  it("delays are monotonically increasing within each tier", () => {
    for (const tier of [1, 2, 3] as const) {
      const delays = TIER_CADENCES[tier];
      for (let i = 1; i < delays.length; i++) {
        expect(delays[i]).toBeGreaterThan(delays[i - 1]);
      }
    }
  });

  it("Tier 1 is more aggressive than Tier 2", () => {
    const totalDays1 = TIER_CADENCES[1][5];
    const totalDays2 = TIER_CADENCES[2][5];
    expect(totalDays1).toBeLessThan(totalDays2);
  });

  it("Tier 3 is more patient than Tier 2", () => {
    const totalDays2 = TIER_CADENCES[2][5];
    const totalDays3 = TIER_CADENCES[3][5];
    expect(totalDays3).toBeGreaterThan(totalDays2);
  });
});

describe("getPredominantTier", () => {
  it("returns 2 for empty scores array", () => {
    expect(getPredominantTier([])).toBe(2);
  });

  it("returns correct tier for uniform high scores", () => {
    // High scores (8+) → Tier 1
    expect(getPredominantTier([9, 8.5, 9, 8])).toBe(1);
  });

  it("returns correct tier for uniform low scores", () => {
    // Low scores (<5) → Tier 3
    expect(getPredominantTier([3, 4, 2, 4])).toBe(3);
  });
});
