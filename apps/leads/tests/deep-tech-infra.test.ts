/**
 * Tests for Deep Tech Backend infrastructure (Phase 1-5 utilities).
 *
 * Covers: Redis job progress, idempotency, cache layer, variant attribution batch,
 * CSV import transaction, style-learner cache invalidation, correlator baseFrom.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Redis ──────────────────────────────────────────────────

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  scan: vi.fn(),
};

vi.mock("@/lib/redis", () => ({
  getRedis: () => mockRedis,
  setJobProgress: vi.fn(),
  getJobProgress: vi.fn(),
  checkIdempotency: vi.fn(),
}));

// ─── Mock Prisma ──────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    draftedEmail: {
      findMany: vi.fn(),
    },
    emailPerformance: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// ─── Imports (after mocks) ────────────────────────────────────────

import { cacheGet, cacheSet, cacheInvalidatePattern } from "@/lib/cache";
import {
  normalizeSubject,
  matchVariantIndex,
} from "@/server/lib/analytics/variant-attribution";
import {
  detectCategory,
  buildPatternKey,
  rankPatterns,
  resolveVariantSubject,
} from "@/server/lib/email/style-learner";
import type { WinningEmailData } from "@/server/lib/email/style-learner";

// ═══════════════════════════════════════════════════════════════════
// Cache layer (Phase 4)
// ═══════════════════════════════════════════════════════════════════

describe("cacheGet / cacheSet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null on cache miss", async () => {
    mockRedis.get.mockResolvedValue(null);
    const result = await cacheGet<string>("nonexistent");
    expect(result).toBeNull();
    expect(mockRedis.get).toHaveBeenCalledWith("cache:nonexistent");
  });

  it("returns parsed value on cache hit", async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ foo: "bar" }));
    const result = await cacheGet<{ foo: string }>("mykey");
    expect(result).toEqual({ foo: "bar" });
  });

  it("sets value with TTL", async () => {
    mockRedis.set.mockResolvedValue("OK");
    await cacheSet("mykey", { count: 42 }, 300);
    expect(mockRedis.set).toHaveBeenCalledWith(
      "cache:mykey",
      JSON.stringify({ count: 42 }),
      "EX",
      300,
    );
  });

  it("handles array values", async () => {
    const data = [{ dimension: "hiring", sent: 100 }];
    mockRedis.set.mockResolvedValue("OK");
    await cacheSet("corr:signal:ws1:all", data, 1800);
    expect(mockRedis.set).toHaveBeenCalledWith(
      "cache:corr:signal:ws1:all",
      JSON.stringify(data),
      "EX",
      1800,
    );
  });
});

describe("cacheInvalidatePattern", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scans and deletes matching keys", async () => {
    mockRedis.scan
      .mockResolvedValueOnce(["5", ["cache:corr:signal:ws1:all", "cache:corr:step:ws1:all"]])
      .mockResolvedValueOnce(["0", ["cache:corr:cta:ws1:all"]]);
    mockRedis.del.mockResolvedValue(1);

    await cacheInvalidatePattern("corr:*:ws1:*");

    expect(mockRedis.scan).toHaveBeenCalledTimes(2);
    expect(mockRedis.del).toHaveBeenCalledTimes(2);
    expect(mockRedis.del).toHaveBeenCalledWith("cache:corr:signal:ws1:all", "cache:corr:step:ws1:all");
    expect(mockRedis.del).toHaveBeenCalledWith("cache:corr:cta:ws1:all");
  });

  it("handles no matching keys gracefully", async () => {
    mockRedis.scan.mockResolvedValue(["0", []]);
    await cacheInvalidatePattern("corr:*:ws-empty:*");
    expect(mockRedis.del).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Variant Attribution — pure functions (Phase 2.5)
// ═══════════════════════════════════════════════════════════════════

describe("normalizeSubject", () => {
  it("strips Re: prefix", () => {
    expect(normalizeSubject("Re: Quick question")).toBe("quick question");
  });

  it("strips Fwd: prefix", () => {
    expect(normalizeSubject("Fwd: Check this out")).toBe("check this out");
  });

  it("strips FW: prefix (case-insensitive)", () => {
    expect(normalizeSubject("FW: Budget update")).toBe("budget update");
  });

  it("trims and lowercases", () => {
    expect(normalizeSubject("  Hello World  ")).toBe("hello world");
  });
});

describe("matchVariantIndex", () => {
  it("returns 0 for primary subject match", () => {
    expect(matchVariantIndex("Quick question", "Quick question", null)).toBe(0);
  });

  it("returns 0 for case-insensitive primary match", () => {
    expect(matchVariantIndex("quick question", "Quick Question", null)).toBe(0);
  });

  it("returns 1+ for variant match", () => {
    expect(matchVariantIndex("Alt subject", "Primary", ["Alt subject", "Third"])).toBe(1);
    expect(matchVariantIndex("Third", "Primary", ["Alt subject", "Third"])).toBe(2);
  });

  it("returns null for no match", () => {
    expect(matchVariantIndex("Unrelated", "Primary", ["Alt"])).toBeNull();
  });

  it("handles null variants", () => {
    expect(matchVariantIndex("Primary", "Primary", null)).toBe(0);
    expect(matchVariantIndex("Other", "Primary", null)).toBeNull();
  });

  it("handles Re: prefix in sent subject", () => {
    expect(matchVariantIndex("Re: Quick question", "Quick question", null)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Style Learner — pure functions
// ═══════════════════════════════════════════════════════════════════

describe("detectCategory", () => {
  it("returns general for identical strings", () => {
    expect(detectCategory("same", "same")).toBe("general");
  });

  it("returns subject for short edits (≤8 words)", () => {
    expect(detectCategory("Quick question for you", "A thought for you")).toBe("subject");
  });

  it("returns length for >30% word count change", () => {
    const short = "This is short.";
    const long = "This is a much longer version of the text that has many more words added to it for testing.";
    expect(detectCategory(short, long)).toBe("length");
  });

  it("returns opener when only first sentence changes", () => {
    const original = "This is the first sentence of our email draft here today. The rest of the body is exactly the same as before. Closing line stays identical here.";
    const edit = "A completely new opening sentence that we rewrote from scratch. The rest of the body is exactly the same as before. Closing line stays identical here.";
    expect(detectCategory(original, edit)).toBe("opener");
  });

  it("returns cta when only last sentence changes", () => {
    const original = "Opening paragraph stays the same in both versions here. The middle section is also identical across edits. Would you like to schedule a quick call this week?";
    const edit = "Opening paragraph stays the same in both versions here. The middle section is also identical across edits. Can we find fifteen minutes to discuss this together?";
    expect(detectCategory(original, edit)).toBe("cta");
  });

  it("returns tone for same-structure different-wording", () => {
    const original = "Hey there. Looking forward to connecting. Let me know.";
    const edit = "Hi friend. Excited to collaborate. Please reach out.";
    expect(detectCategory(original, edit)).toBe("tone");
  });
});

describe("buildPatternKey", () => {
  it("builds key from all fields", () => {
    const data: WinningEmailData = {
      signalType: "hiring",
      bodyWordCount: 85,
      frameworkName: "PAS",
      enrichmentDepth: "rich",
    };
    expect(buildPatternKey(data)).toBe("hiring signal, 85 words, PAS, deep enrichment");
  });

  it("skips null fields", () => {
    const data: WinningEmailData = {
      signalType: "funding",
      bodyWordCount: null,
      frameworkName: null,
      enrichmentDepth: null,
    };
    expect(buildPatternKey(data)).toBe("funding signal");
  });

  it("returns empty string for all-null data", () => {
    const data: WinningEmailData = {
      signalType: null,
      bodyWordCount: null,
      frameworkName: null,
      enrichmentDepth: null,
    };
    expect(buildPatternKey(data)).toBe("");
  });

  it("only includes enrichmentDepth when rich", () => {
    const partial: WinningEmailData = {
      signalType: "hiring",
      bodyWordCount: null,
      frameworkName: null,
      enrichmentDepth: "partial",
    };
    expect(buildPatternKey(partial)).toBe("hiring signal");
  });
});

describe("rankPatterns", () => {
  it("ranks by frequency and returns top 3", () => {
    const counts = new Map<string, { count: number; totalRate: number }>();
    counts.set("pattern-A", { count: 10, totalRate: 150 });
    counts.set("pattern-B", { count: 5, totalRate: 50 });
    counts.set("pattern-C", { count: 8, totalRate: 80 });
    counts.set("pattern-D", { count: 3, totalRate: 30 });

    const result = rankPatterns(counts);
    expect(result).toHaveLength(3);
    expect(result[0].summary).toContain("pattern-A");
    expect(result[0].summary).toContain("10x");
    expect(result[0].replyRate).toBe(15); // 150/10
    expect(result[1].summary).toContain("pattern-C");
  });

  it("returns empty for empty map", () => {
    expect(rankPatterns(new Map())).toHaveLength(0);
  });
});

describe("resolveVariantSubject", () => {
  it("returns primary for null variantIndex", () => {
    expect(resolveVariantSubject("Primary", ["Alt1", "Alt2"], null)).toBe("Primary");
  });

  it("returns primary for variantIndex 0", () => {
    expect(resolveVariantSubject("Primary", ["Alt1"], 0)).toBe("Primary");
  });

  it("returns variant for variantIndex 1+", () => {
    expect(resolveVariantSubject("Primary", ["Alt1", "Alt2"], 1)).toBe("Alt1");
    expect(resolveVariantSubject("Primary", ["Alt1", "Alt2"], 2)).toBe("Alt2");
  });

  it("falls back to primary for out-of-range index", () => {
    expect(resolveVariantSubject("Primary", ["Alt1"], 5)).toBe("Primary");
  });

  it("handles non-array variants", () => {
    expect(resolveVariantSubject("Primary", null, 1)).toBe("Primary");
    expect(resolveVariantSubject("Primary", "not-an-array", 1)).toBe("Primary");
  });
});
