import { describe, it, expect } from "vitest";
import {
  shouldPauseOnNegativeReplies,
  NEGATIVE_REPLY_THRESHOLD,
  NEGATIVE_REPLY_AI_INTEREST_MAX,
  MIN_SENDS_FOR_REPLY_CHECK,
} from "@/server/lib/analytics/reply-guard";

// ─── Constants ──────────────────────────────────────────

describe("reply guard constants", () => {
  it("negative reply threshold is 3", () => {
    expect(NEGATIVE_REPLY_THRESHOLD).toBe(3);
  });

  it("negative reply ai interest max is 3 (< 3 = negative)", () => {
    expect(NEGATIVE_REPLY_AI_INTEREST_MAX).toBe(3);
  });

  it("minimum sends before check is 20", () => {
    expect(MIN_SENDS_FOR_REPLY_CHECK).toBe(20);
  });
});

// ─── shouldPauseOnNegativeReplies (pure logic) ──────────

describe("shouldPauseOnNegativeReplies", () => {
  it("does NOT pause when total sends < minimum threshold", () => {
    const result = shouldPauseOnNegativeReplies(15, 5);
    expect(result.shouldPause).toBe(false);
    expect(result.rate).toBeCloseTo(5 / 15, 5);
  });

  it("does NOT pause when sends = 0", () => {
    const result = shouldPauseOnNegativeReplies(0, 0);
    expect(result.shouldPause).toBe(false);
    expect(result.rate).toBe(0);
  });

  it("does NOT pause when negative replies < threshold", () => {
    const result = shouldPauseOnNegativeReplies(100, 2);
    expect(result.shouldPause).toBe(false);
    expect(result.rate).toBe(0.02);
  });

  it("pauses when negative replies = threshold (3) after 20+ sends", () => {
    const result = shouldPauseOnNegativeReplies(50, 3);
    expect(result.shouldPause).toBe(true);
    expect(result.rate).toBe(0.06);
  });

  it("pauses when negative replies > threshold", () => {
    const result = shouldPauseOnNegativeReplies(100, 5);
    expect(result.shouldPause).toBe(true);
    expect(result.rate).toBe(0.05);
  });

  it("pauses at minimum sends threshold (20 sends, 3 negative)", () => {
    const result = shouldPauseOnNegativeReplies(20, 3);
    expect(result.shouldPause).toBe(true);
    expect(result.rate).toBe(0.15);
  });

  it("does NOT pause at 19 sends even with many negative replies", () => {
    const result = shouldPauseOnNegativeReplies(19, 10);
    expect(result.shouldPause).toBe(false);
    expect(result.rate).toBeCloseTo(10 / 19, 5);
  });

  it("does NOT pause with 0 negative replies", () => {
    const result = shouldPauseOnNegativeReplies(200, 0);
    expect(result.shouldPause).toBe(false);
    expect(result.rate).toBe(0);
  });

  it("does NOT pause with 1 negative reply", () => {
    const result = shouldPauseOnNegativeReplies(100, 1);
    expect(result.shouldPause).toBe(false);
    expect(result.rate).toBe(0.01);
  });

  it("does NOT pause with 2 negative replies", () => {
    const result = shouldPauseOnNegativeReplies(50, 2);
    expect(result.shouldPause).toBe(false);
    expect(result.rate).toBe(0.04);
  });
});

// ─── Real-world scenarios ───────────────────────────────

describe("real-world scenarios", () => {
  it("early campaign with one angry prospect — no pause", () => {
    // Day 1: 10 emails sent, 1 negative reply — too few sends to judge
    const result = shouldPauseOnNegativeReplies(10, 1);
    expect(result.shouldPause).toBe(false);
  });

  it("small campaign with occasional rejection — no pause", () => {
    // 30 sends, 2 negative replies (6.7%) — below threshold count
    const result = shouldPauseOnNegativeReplies(30, 2);
    expect(result.shouldPause).toBe(false);
  });

  it("wrong ICP causing complaint cascade — auto-pause", () => {
    // 50 sends, 4 negative replies in 24h — wrong targeting
    const result = shouldPauseOnNegativeReplies(50, 4);
    expect(result.shouldPause).toBe(true);
    expect(result.rate).toBe(0.08);
  });

  it("toxic messaging triggering spam reports — auto-pause", () => {
    // 100 sends, 6 negative replies in 24h — messaging problem
    const result = shouldPauseOnNegativeReplies(100, 6);
    expect(result.shouldPause).toBe(true);
    expect(result.rate).toBe(0.06);
  });

  it("healthy campaign with rare complaints — no pause", () => {
    // 500 sends, 2 negative replies — normal for cold outreach
    const result = shouldPauseOnNegativeReplies(500, 2);
    expect(result.shouldPause).toBe(false);
    expect(result.rate).toBe(0.004);
  });

  it("large campaign with sudden complaint spike — auto-pause", () => {
    // 1000 sends, 3 negative replies in 24h — something changed
    const result = shouldPauseOnNegativeReplies(1000, 3);
    expect(result.shouldPause).toBe(true);
    expect(result.rate).toBe(0.003);
  });

  it("large healthy campaign — no pause", () => {
    // 2000 sends, 2 negative replies — very healthy
    const result = shouldPauseOnNegativeReplies(2000, 2);
    expect(result.shouldPause).toBe(false);
    expect(result.rate).toBe(0.001);
  });

  it("borderline: exactly at threshold with minimum sends", () => {
    // 20 sends, 3 negative replies = exactly at both thresholds
    const result = shouldPauseOnNegativeReplies(20, 3);
    expect(result.shouldPause).toBe(true);
    expect(result.rate).toBe(0.15);
  });
});
