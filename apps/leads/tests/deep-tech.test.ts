import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock correlator ─────────────────────────────────────────────────
vi.mock("@/server/lib/analytics/correlator", () => ({
  getReplyRateBySignalType: vi.fn(),
  getReplyRateByStep: vi.fn(),
  getReplyRateByCta: vi.fn(),
  getReplyRateByQualityScore: vi.fn(),
  getReplyRateByIcpScore: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentMemory: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import type { CorrelationRow } from "@/server/lib/analytics/correlator";
import { getReplyRateBySignalType, getReplyRateByStep, getReplyRateByCta } from "@/server/lib/analytics/correlator";
import { getSignalRanking, getCtaRanking, getDataDrivenWeights } from "@/server/lib/analytics/adaptive";
import { getMinQualityScore, getDynamicQualityThreshold, QUALITY_GATE_MEMORY_KEY } from "@/server/lib/email/quality-gate";
import { extractCta } from "@/server/lib/email/draft-lead";
import { prisma } from "@/lib/prisma";

const mockSignalType = vi.mocked(getReplyRateBySignalType);
const mockStep = vi.mocked(getReplyRateByStep);
const mockCta = vi.mocked(getReplyRateByCta);
const mockAgentMemory = vi.mocked(prisma.agentMemory);

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

// ═══════════════════════════════════════════════════════════════════════
// Changement 1: getSignalRanking (Thompson Sampling on signal types)
// ═══════════════════════════════════════════════════════════════════════

describe("getSignalRanking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when total sent < 30", async () => {
    mockSignalType.mockResolvedValue([
      makeRow("hiring", 15, 5, 3),
      makeRow("funding", 10, 3, 1),
    ]);
    const result = await getSignalRanking("ws-1");
    expect(result).toBeNull();
  });

  it("returns null when fewer than 2 signal types", async () => {
    mockSignalType.mockResolvedValue([
      makeRow("hiring", 50, 20, 10),
    ]);
    const result = await getSignalRanking("ws-1");
    expect(result).toBeNull();
  });

  it("returns Thompson-ranked weights with enough data", async () => {
    mockSignalType.mockResolvedValue([
      makeRow("hiring", 100, 30, 20),      // 20% reply rate
      makeRow("leadership_change", 80, 25, 8), // 10% reply rate
      makeRow("funding", 50, 15, 2),        // 4% reply rate
    ]);

    const result = await getSignalRanking("ws-1");
    expect(result).not.toBeNull();
    // All observed signal types should be present
    expect(result!["hiring"]).toBeDefined();
    expect(result!["leadership_change"]).toBeDefined();
    expect(result!["funding"]).toBeDefined();
    // Thompson is stochastic, but the top-ranked always gets 10 (normalization)
    const maxWeight = Math.max(...Object.values(result!));
    expect(maxWeight).toBe(10);
    // All weights in 0-10 range
    for (const w of Object.values(result!)) {
      expect(w).toBeGreaterThan(0);
      expect(w).toBeLessThanOrEqual(10);
    }
    // Unobserved types should get backfilled
    expect(result!["signal"]).toBeDefined();
    expect(result!["tech_stack_change"]).toBeDefined();
  });

  it("backfills unobserved signal types at half default weight", async () => {
    mockSignalType.mockResolvedValue([
      makeRow("hiring", 100, 30, 20),
      makeRow("funding", 50, 15, 5),
    ]);

    const result = await getSignalRanking("ws-1");
    expect(result).not.toBeNull();
    // Default weights: leadership_change=5, public_priority=2.5, tech_stack_change=2, signal=1
    // Backfill = default * 0.5
    expect(result!["leadership_change"]).toBe(2.5); // 5 * 0.5
    expect(result!["public_priority"]).toBe(1.25);  // 2.5 * 0.5
    expect(result!["tech_stack_change"]).toBe(1);   // 2 * 0.5
    expect(result!["signal"]).toBe(0.5);            // 1 * 0.5
  });

  it("getDataDrivenWeights still works (backward compat)", async () => {
    mockSignalType.mockResolvedValue([
      makeRow("hiring", 50, 20, 10),      // 20%
      makeRow("funding", 50, 10, 5),      // 10%
    ]);
    const result = await getDataDrivenWeights("ws-1");
    expect(result).not.toBeNull();
    expect(result!["hiring"]).toBe(10);
    expect(result!["funding"]).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Changement 2: getCtaRanking (Thompson Sampling on CTAs)
// ═══════════════════════════════════════════════════════════════════════

describe("getCtaRanking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when insufficient data for step", async () => {
    mockCta.mockResolvedValue([
      makeRow("s0:Worth a quick look?", 10, 5, 2),
      makeRow("s0:Does this resonate?", 15, 4, 1),
    ]);
    const result = await getCtaRanking("ws-1", 0);
    expect(result).toBeNull();
  });

  it("returns null when fewer than 2 CTAs for step", async () => {
    mockCta.mockResolvedValue([
      makeRow("s0:Worth a quick look?", 50, 20, 10),
    ]);
    const result = await getCtaRanking("ws-1", 0);
    expect(result).toBeNull();
  });

  it("returns ranked CTAs for step with enough data", async () => {
    mockCta.mockResolvedValue([
      makeRow("s0:Worth a quick look?", 80, 30, 15),
      makeRow("s0:Does this resonate?", 60, 20, 5),
      makeRow("s1:Want me to send it?", 40, 15, 8),  // different step
    ]);
    const result = await getCtaRanking("ws-1", 0);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    // Stripped prefix, actual CTA strings
    expect(result![0]).not.toContain("s0:");
    expect(result![1]).not.toContain("s0:");
  });

  it("filters CTAs to requested step only", async () => {
    mockCta.mockResolvedValue([
      makeRow("s0:CTA A", 50, 20, 10),
      makeRow("s0:CTA B", 50, 15, 5),
      makeRow("s1:CTA C", 40, 10, 8),
      makeRow("s1:CTA D", 40, 10, 3),
    ]);
    const step0 = await getCtaRanking("ws-1", 0);
    expect(step0).not.toBeNull();
    expect(step0).toHaveLength(2);
    expect(step0!.some((c) => c === "CTA C")).toBe(false);

    const step1 = await getCtaRanking("ws-1", 1);
    expect(step1).not.toBeNull();
    expect(step1).toHaveLength(2);
    expect(step1!.some((c) => c === "CTA A")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Changement 2: extractCta
// ═══════════════════════════════════════════════════════════════════════

describe("extractCta", () => {
  it("extracts last question from email body", () => {
    const body = "Thomas,\n\nSince your Series B, scaling outbound is key.\n\nWorth a quick look?";
    const cta = extractCta(body);
    expect(cta).toBe("Worth a quick look?");
  });

  it("handles escaped newlines", () => {
    const body = "Thomas,\\n\\nSaw you're hiring SDRs.\\n\\nWorth a 10-min call?";
    const cta = extractCta(body);
    expect(cta).toBe("Worth a 10-min call?");
  });

  it("returns null for empty body", () => {
    expect(extractCta("")).toBeNull();
    expect(extractCta("hi")).toBeNull(); // too short
  });

  it("truncates CTA to max 100 chars", () => {
    const longQuestion = "Would you be interested in learning about how our platform specifically helps companies in your exact situation with this very long and detailed question?";
    const body = `Thomas,\n\n${longQuestion}`;
    const cta = extractCta(body);
    expect(cta).not.toBeNull();
    expect(cta!.length).toBeLessThanOrEqual(100);
  });

  it("extracts last question when multiple exist on separate lines", () => {
    const body = "Thomas,\n\nSaw the announcement. Relevant?\n\nDefinitely worth a look.\n\nWorth exploring together?";
    const cta = extractCta(body);
    expect(cta).toBe("Worth exploring together?");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Changement 3: Quality Gate dynamic threshold
// ═══════════════════════════════════════════════════════════════════════

describe("getMinQualityScore", () => {
  it("step 0 always returns 8 regardless of dynamic threshold", () => {
    expect(getMinQualityScore(0)).toBe(8);
    expect(getMinQualityScore(0, 6)).toBe(8);
    expect(getMinQualityScore(0, 7)).toBe(8);
  });

  it("non-step-0 uses dynamic threshold when provided", () => {
    expect(getMinQualityScore(1, 7)).toBe(7);
    expect(getMinQualityScore(3, 6)).toBe(6);
  });

  it("non-step-0 falls back to 7 without dynamic threshold", () => {
    expect(getMinQualityScore(1)).toBe(7);
    expect(getMinQualityScore(5)).toBe(7);
  });
});

describe("getDynamicQualityThreshold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no memory entry exists", async () => {
    mockAgentMemory.findUnique.mockResolvedValue(null);
    const result = await getDynamicQualityThreshold("ws-1");
    expect(result).toBeNull();
  });

  it("returns parsed integer from memory value", async () => {
    mockAgentMemory.findUnique.mockResolvedValue({
      id: "mem-1",
      workspaceId: "ws-1",
      key: QUALITY_GATE_MEMORY_KEY,
      value: "7",
      category: "GENERAL",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await getDynamicQualityThreshold("ws-1");
    expect(result).toBe(7);
  });

  it("returns null for non-numeric memory value", async () => {
    mockAgentMemory.findUnique.mockResolvedValue({
      id: "mem-1",
      workspaceId: "ws-1",
      key: QUALITY_GATE_MEMORY_KEY,
      value: "invalid",
      category: "GENERAL",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await getDynamicQualityThreshold("ws-1");
    expect(result).toBeNull();
  });
});
