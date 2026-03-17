import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CorrelationRow } from "@/server/lib/analytics/correlator";
import { buildInsight, getConfidence, type PerformanceInsight } from "@/server/lib/analytics/insights";

// ─── Helper ──────────────────────────────────────────────
function makeRow(dimension: string, sent: number, opened: number, replied: number): CorrelationRow {
  return {
    dimension,
    sent,
    opened,
    replied,
    openRate: sent > 0 ? Math.round((opened / sent) * 10000) / 100 : 0,
    replyRate: sent > 0 ? Math.round((replied / sent) * 10000) / 100 : 0,
  };
}

// ═══════════════════════════════════════════════════════════
// getConfidence
// ═══════════════════════════════════════════════════════════

describe("getConfidence", () => {
  it("returns 'high' for totalSent >= 50", () => {
    expect(getConfidence(50)).toBe("high");
    expect(getConfidence(100)).toBe("high");
    expect(getConfidence(1000)).toBe("high");
  });

  it("returns 'medium' for totalSent >= 20 and < 50", () => {
    expect(getConfidence(20)).toBe("medium");
    expect(getConfidence(35)).toBe("medium");
    expect(getConfidence(49)).toBe("medium");
  });

  it("returns 'low' for totalSent < 20", () => {
    expect(getConfidence(0)).toBe("low");
    expect(getConfidence(5)).toBe("low");
    expect(getConfidence(19)).toBe("low");
  });
});

// ═══════════════════════════════════════════════════════════
// buildInsight
// ═══════════════════════════════════════════════════════════

describe("buildInsight", () => {
  it("returns null when fewer than 2 rows", () => {
    expect(buildInsight("signal_type", [])).toBeNull();
    expect(buildInsight("signal_type", [makeRow("hiring", 100, 40, 10)])).toBeNull();
  });

  it("returns null when totalSent < 20", () => {
    const rows = [makeRow("hiring", 8, 3, 1), makeRow("funding", 10, 4, 2)];
    expect(buildInsight("signal_type", rows)).toBeNull();
  });

  it("returns null when totalSent is exactly 19", () => {
    const rows = [makeRow("hiring", 10, 3, 1), makeRow("funding", 9, 4, 2)];
    expect(buildInsight("signal_type", rows)).toBeNull();
  });

  it("returns insight when totalSent is exactly 20", () => {
    const rows = [makeRow("hiring", 10, 3, 2), makeRow("funding", 10, 4, 1)];
    const result = buildInsight("signal_type", rows);
    expect(result).not.toBeNull();
    expect(result!.dimension).toBe("signal_type");
  });

  it("correctly identifies top and bottom performers", () => {
    const rows = [
      makeRow("hiring", 50, 20, 10),    // 20% reply rate
      makeRow("funding", 50, 25, 5),    // 10% reply rate
      makeRow("tech_change", 50, 30, 15), // 30% reply rate
    ];
    const result = buildInsight("signal_type", rows)!;
    expect(result.topPerformer.label).toBe("tech_change");
    expect(result.topPerformer.replyRate).toBe(30);
    expect(result.topPerformer.sampleSize).toBe(50);
    expect(result.bottomPerformer.label).toBe("funding");
    expect(result.bottomPerformer.replyRate).toBe(10);
    expect(result.bottomPerformer.sampleSize).toBe(50);
  });

  it("computes correct confidence levels", () => {
    // High confidence (>= 50 total sent)
    const highRows = [makeRow("a", 30, 10, 3), makeRow("b", 25, 8, 2)];
    expect(buildInsight("industry", highRows)!.confidence).toBe("high");

    // Medium confidence (>= 20, < 50 total sent)
    const medRows = [makeRow("a", 12, 4, 1), makeRow("b", 10, 3, 1)];
    expect(buildInsight("industry", medRows)!.confidence).toBe("medium");
  });

  it("generates recommendation text for signal_type dimension", () => {
    const rows = [makeRow("hiring", 30, 10, 6), makeRow("funding", 30, 10, 3)];
    const result = buildInsight("signal_type", rows)!;
    expect(result.recommendation).toContain("hiring");
    expect(result.recommendation).toContain("funding");
    expect(result.recommendation).toContain("prioritize");
  });

  it("generates recommendation text for framework dimension", () => {
    const rows = [makeRow("PAS", 40, 10, 8), makeRow("Breakup", 40, 10, 2)];
    const result = buildInsight("framework", rows)!;
    expect(result.recommendation).toContain("PAS");
    expect(result.recommendation).toContain("Breakup");
    expect(result.recommendation).toContain("performs best");
  });

  it("generates recommendation text for quality_score dimension", () => {
    const rows = [makeRow("9-10", 30, 10, 5), makeRow("1-4", 30, 10, 1)];
    const result = buildInsight("quality_score", rows)!;
    expect(result.recommendation).toContain("9-10");
    expect(result.recommendation).toContain("1-4");
  });

  it("generates recommendation text for enrichment_depth dimension", () => {
    const rows = [makeRow("rich", 30, 10, 5), makeRow("minimal", 30, 10, 1)];
    const result = buildInsight("enrichment_depth", rows)!;
    expect(result.recommendation).toContain("rich");
    expect(result.recommendation).toContain("minimal");
    expect(result.recommendation).toContain("enrichment");
  });

  it("generates recommendation text for industry dimension", () => {
    const rows = [makeRow("SaaS", 30, 10, 5), makeRow("Healthcare", 30, 10, 1)];
    const result = buildInsight("industry", rows)!;
    expect(result.recommendation).toContain("SaaS");
    expect(result.recommendation).toContain("Healthcare");
    expect(result.recommendation).toContain("industry");
  });

  it("generates recommendation text for word_count dimension", () => {
    const rows = [makeRow("50-80", 30, 10, 5), makeRow("120+", 30, 10, 1)];
    const result = buildInsight("word_count", rows)!;
    expect(result.recommendation).toContain("50-80");
    expect(result.recommendation).toContain("120+");
  });

  it("generates recommendation text for subject_variant dimension", () => {
    const rows = [makeRow("Quick Q", 30, 10, 5), makeRow("Ideas for you", 30, 10, 1)];
    const result = buildInsight("subject_variant", rows)!;
    expect(result.recommendation).toContain("Quick Q");
    expect(result.recommendation).toContain("pattern");
  });

  it("generates recommendation text for subject_pattern dimension", () => {
    const rows = [makeRow("Question", 30, 10, 5), makeRow("Direct", 30, 10, 1)];
    const result = buildInsight("subject_pattern", rows)!;
    expect(result.recommendation).toContain("Question");
    expect(result.recommendation).toContain("Direct");
  });

  it("falls back to generic recommendation for unknown dimension", () => {
    // Force unknown dimension — cast to bypass type check
    const rows = [makeRow("alpha", 30, 10, 5), makeRow("beta", 30, 10, 1)];
    const result = buildInsight("unknown" as PerformanceInsight["dimension"], rows)!;
    expect(result.recommendation).toContain("alpha");
    expect(result.recommendation).toContain("outperforms");
    expect(result.recommendation).toContain("beta");
  });

  it("handles two rows with equal replyRate", () => {
    const rows = [makeRow("A", 30, 10, 3), makeRow("B", 30, 10, 3)];
    const result = buildInsight("industry", rows)!;
    // Both have same rate — top and bottom should still be set
    expect(result.topPerformer.replyRate).toBe(result.bottomPerformer.replyRate);
  });

  it("handles rows with zero replyRate", () => {
    const rows = [makeRow("A", 30, 10, 0), makeRow("B", 30, 10, 0)];
    const result = buildInsight("industry", rows)!;
    expect(result.topPerformer.replyRate).toBe(0);
    expect(result.bottomPerformer.replyRate).toBe(0);
  });

  it("includes reply rate percentages in recommendation", () => {
    const rows = [makeRow("hiring", 40, 10, 4), makeRow("funding", 40, 10, 2)];
    const result = buildInsight("signal_type", rows)!;
    expect(result.recommendation).toContain("10.0%");
    expect(result.recommendation).toContain("5.0%");
  });
});

// ═══════════════════════════════════════════════════════════
// getDataDrivenWeights (mock correlator)
// ═══════════════════════════════════════════════════════════

// Mock correlator before importing adaptive
vi.mock("@/server/lib/analytics/correlator", () => ({
  getReplyRateBySignalType: vi.fn(),
  getReplyRateByStep: vi.fn(),
  POSITIVE_REPLY_INTEREST_THRESHOLD: 5,
  isPositiveReply: vi.fn(),
}));

// Must import after mock
import { getDataDrivenWeights, getStepAnnotation } from "@/server/lib/analytics/adaptive";
import { getReplyRateBySignalType, getReplyRateByStep } from "@/server/lib/analytics/correlator";

const mockSignalType = vi.mocked(getReplyRateBySignalType);
const mockStep = vi.mocked(getReplyRateByStep);

describe("getDataDrivenWeights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when < 2 significant signal types", () => {
    mockSignalType.mockResolvedValue([
      makeRow("hiring", 30, 10, 5), // Only 1 significant row (>= 20 sent)
      makeRow("funding", 10, 3, 1), // Below 20 sent threshold
    ]);
    return expect(getDataDrivenWeights("ws-1")).resolves.toBeNull();
  });

  it("returns null when zero significant rows", () => {
    mockSignalType.mockResolvedValue([]);
    return expect(getDataDrivenWeights("ws-1")).resolves.toBeNull();
  });

  it("returns null when maxRate is 0", () => {
    mockSignalType.mockResolvedValue([
      makeRow("hiring", 100, 30, 0),
      makeRow("funding", 50, 10, 0),
    ]);
    return expect(getDataDrivenWeights("ws-1")).resolves.toBeNull();
  });

  it("normalizes reply rates to 0-10 scale", async () => {
    mockSignalType.mockResolvedValue([
      makeRow("hiring", 100, 40, 10),    // 10% reply rate
      makeRow("funding", 50, 20, 5),     // 10% reply rate
      makeRow("tech_change", 80, 30, 16), // 20% reply rate
    ]);
    const result = await getDataDrivenWeights("ws-1");
    expect(result).not.toBeNull();
    // tech_change has max rate (20%), should be 10.0
    expect(result!["tech_change"]).toBe(10);
    // hiring and funding have 10% rate (half of max), should be 5.0
    expect(result!["hiring"]).toBe(5);
    expect(result!["funding"]).toBe(5);
  });

  it("filters rows with < 20 sent before normalization", async () => {
    mockSignalType.mockResolvedValue([
      makeRow("hiring", 100, 30, 10),     // 10% reply rate, significant
      makeRow("funding", 50, 20, 5),      // 10% reply rate, significant
      makeRow("noise", 15, 10, 3),        // < 20 sent, should be excluded
    ]);
    const result = await getDataDrivenWeights("ws-1");
    expect(result).not.toBeNull();
    expect(result!["noise"]).toBeUndefined();
    expect(result!["hiring"]).toBeDefined();
    expect(result!["funding"]).toBeDefined();
  });

  it("handles single dominant signal type correctly", async () => {
    mockSignalType.mockResolvedValue([
      makeRow("hiring", 100, 30, 20),     // 20% reply rate (max)
      makeRow("funding", 50, 10, 1),      // 2% reply rate
    ]);
    const result = await getDataDrivenWeights("ws-1");
    expect(result).not.toBeNull();
    expect(result!["hiring"]).toBe(10);    // max → 10
    expect(result!["funding"]).toBe(1);    // 2/20 * 10 = 1
  });
});

// ═══════════════════════════════════════════════════════════
// getStepAnnotation (mock correlator)
// ═══════════════════════════════════════════════════════════

describe("getStepAnnotation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when < 2 rows from correlator", () => {
    mockStep.mockResolvedValue([makeRow("PAS (Timeline Hook)", 100, 30, 10)]);
    return expect(getStepAnnotation("ws-1", 0)).resolves.toBeNull();
  });

  it("returns null when step not found in rows", () => {
    mockStep.mockResolvedValue([
      makeRow("PAS (Timeline Hook)", 100, 30, 10),
      makeRow("Value-add", 80, 20, 5),
    ]);
    // Step 5 = "Breakup" — not in the results
    return expect(getStepAnnotation("ws-1", 5)).resolves.toBeNull();
  });

  it("returns null when step has < 50 sent", () => {
    mockStep.mockResolvedValue([
      makeRow("PAS (Timeline Hook)", 40, 10, 5), // < 50 sent
      makeRow("Value-add", 80, 20, 5),
    ]);
    return expect(getStepAnnotation("ws-1", 0)).resolves.toBeNull();
  });

  it("returns correct annotation for top-performing step", async () => {
    mockStep.mockResolvedValue([
      makeRow("PAS (Timeline Hook)", 100, 30, 15), // 15% reply rate — TOP
      makeRow("Value-add", 80, 20, 5),              // 6.25% reply rate
      makeRow("Social Proof", 60, 10, 3),            // 5% reply rate
    ]);
    const result = await getStepAnnotation("ws-1", 0);
    expect(result).not.toBeNull();
    expect(result!.stepName).toBe("PAS (Timeline Hook)");
    expect(result!.replyRate).toBe(15);
    expect(result!.sampleSize).toBe(100);
    expect(result!.isTop).toBe(true);
  });

  it("returns correct annotation for non-top step", async () => {
    mockStep.mockResolvedValue([
      makeRow("PAS (Timeline Hook)", 100, 30, 15), // 15% — TOP
      makeRow("Value-add", 80, 20, 5),              // 6.25%
    ]);
    const result = await getStepAnnotation("ws-1", 1);
    expect(result).not.toBeNull();
    expect(result!.stepName).toBe("Value-add");
    expect(result!.isTop).toBe(false);
  });

  it("handles step beyond framework names (falls back to Step N)", async () => {
    mockStep.mockResolvedValue([
      makeRow("PAS (Timeline Hook)", 100, 30, 10),
      makeRow("Step 10", 60, 20, 8), // Unknown step — framework fallback
    ]);
    const result = await getStepAnnotation("ws-1", 10);
    expect(result).not.toBeNull();
    expect(result!.stepName).toBe("Step 10");
  });

  it("isTop is true when multiple steps share max replyRate", async () => {
    mockStep.mockResolvedValue([
      makeRow("PAS (Timeline Hook)", 100, 30, 10), // 10%
      makeRow("Value-add", 80, 20, 8),              // 10%
    ]);
    // Both are 10% — PAS should be isTop = true
    const result = await getStepAnnotation("ws-1", 0);
    expect(result).not.toBeNull();
    expect(result!.isTop).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// buildPatternKey + rankPatterns (pure functions)
// ═══════════════════════════════════════════════════════════

import { buildPatternKey, rankPatterns, type WinningEmailData } from "@/server/lib/email/style-learner";

describe("buildPatternKey", () => {
  it("builds key from all fields", () => {
    const data: WinningEmailData = {
      signalType: "hiring",
      bodyWordCount: 72,
      frameworkName: "PAS",
      enrichmentDepth: "rich",
    };
    expect(buildPatternKey(data)).toBe("hiring signal, 72 words, PAS, deep enrichment");
  });

  it("omits null signalType", () => {
    const data: WinningEmailData = {
      signalType: null,
      bodyWordCount: 65,
      frameworkName: "Value-add",
      enrichmentDepth: "partial",
    };
    expect(buildPatternKey(data)).toBe("65 words, Value-add");
  });

  it("omits null bodyWordCount", () => {
    const data: WinningEmailData = {
      signalType: "funding",
      bodyWordCount: null,
      frameworkName: "Social Proof",
      enrichmentDepth: "rich",
    };
    expect(buildPatternKey(data)).toBe("funding signal, Social Proof, deep enrichment");
  });

  it("omits non-rich enrichmentDepth", () => {
    const data: WinningEmailData = {
      signalType: "tech_change",
      bodyWordCount: 80,
      frameworkName: "New Angle",
      enrichmentDepth: "partial",
    };
    expect(buildPatternKey(data)).toBe("tech_change signal, 80 words, New Angle");
  });

  it("returns empty string when all fields are null/non-rich", () => {
    const data: WinningEmailData = {
      signalType: null,
      bodyWordCount: null,
      frameworkName: null,
      enrichmentDepth: null,
    };
    expect(buildPatternKey(data)).toBe("");
  });

  it("returns empty string when enrichmentDepth is minimal", () => {
    const data: WinningEmailData = {
      signalType: null,
      bodyWordCount: null,
      frameworkName: null,
      enrichmentDepth: "minimal",
    };
    expect(buildPatternKey(data)).toBe("");
  });

  it("handles 0 bodyWordCount as falsy (omitted)", () => {
    const data: WinningEmailData = {
      signalType: "hiring",
      bodyWordCount: 0,
      frameworkName: null,
      enrichmentDepth: null,
    };
    expect(buildPatternKey(data)).toBe("hiring signal");
  });

  it("includes only frameworkName when others are null", () => {
    const data: WinningEmailData = {
      signalType: null,
      bodyWordCount: null,
      frameworkName: "Breakup",
      enrichmentDepth: null,
    };
    expect(buildPatternKey(data)).toBe("Breakup");
  });
});

describe("rankPatterns", () => {
  it("sorts by frequency descending", () => {
    const counts = new Map([
      ["pattern A", { count: 2, totalRate: 20 }],
      ["pattern C", { count: 5, totalRate: 50 }],
      ["pattern B", { count: 3, totalRate: 30 }],
    ]);
    const result = rankPatterns(counts);
    expect(result[0].summary).toContain("pattern C");
    expect(result[0].summary).toContain("5x");
    expect(result[1].summary).toContain("pattern B");
    expect(result[2].summary).toContain("pattern A");
  });

  it("returns max 3 patterns", () => {
    const counts = new Map([
      ["A", { count: 10, totalRate: 100 }],
      ["B", { count: 8, totalRate: 80 }],
      ["C", { count: 6, totalRate: 60 }],
      ["D", { count: 4, totalRate: 40 }],
      ["E", { count: 2, totalRate: 20 }],
    ]);
    const result = rankPatterns(counts);
    expect(result).toHaveLength(3);
    expect(result[0].summary).toContain("A");
    expect(result[2].summary).toContain("C");
  });

  it("computes average replyRate per pattern", () => {
    const counts = new Map([
      ["pattern X", { count: 4, totalRate: 40 }], // avg = 10
    ]);
    const result = rankPatterns(counts);
    expect(result[0].replyRate).toBe(10);
  });

  it("returns empty array for empty map", () => {
    expect(rankPatterns(new Map())).toEqual([]);
  });

  it("handles single pattern", () => {
    const counts = new Map([
      ["solo", { count: 1, totalRate: 15 }],
    ]);
    const result = rankPatterns(counts);
    expect(result).toHaveLength(1);
    expect(result[0].summary).toContain("1x");
    expect(result[0].summary).toContain("solo");
    expect(result[0].replyRate).toBe(15);
  });

  it("formats summary with count prefix", () => {
    const counts = new Map([
      ["hiring signal, 72 words, PAS", { count: 7, totalRate: 70 }],
    ]);
    const result = rankPatterns(counts);
    expect(result[0].summary).toBe("Winning email pattern (7x): hiring signal, 72 words, PAS");
  });
});
