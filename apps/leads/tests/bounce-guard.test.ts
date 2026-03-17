import { describe, it, expect } from "vitest";
import {
  shouldPauseCampaign,
  BOUNCE_RATE_THRESHOLD,
  MIN_SENDS_FOR_CHECK,
} from "@/server/lib/analytics/bounce-guard";

// ─── Constants ──────────────────────────────────────────

describe("bounce guard constants", () => {
  it("threshold is 3%", () => {
    expect(BOUNCE_RATE_THRESHOLD).toBe(0.03);
  });

  it("minimum sends before check is 50", () => {
    expect(MIN_SENDS_FOR_CHECK).toBe(50);
  });
});

// ─── shouldPauseCampaign (pure logic) ───────────────────

describe("shouldPauseCampaign", () => {
  it("does NOT pause when total sends < minimum threshold", () => {
    const result = shouldPauseCampaign(30, 5);
    expect(result.shouldPause).toBe(false);
    // Still computes bounce rate for informational purposes
    expect(result.bounceRate).toBeCloseTo(5 / 30, 5);
  });

  it("does NOT pause when sends = 0", () => {
    const result = shouldPauseCampaign(0, 0);
    expect(result.shouldPause).toBe(false);
    expect(result.bounceRate).toBe(0);
  });

  it("does NOT pause when bounce rate is at or below 3%", () => {
    // Exactly 3% — should NOT pause (threshold is >3%, not >=3%)
    const result = shouldPauseCampaign(100, 3);
    expect(result.shouldPause).toBe(false);
    expect(result.bounceRate).toBe(0.03);
  });

  it("pauses when bounce rate exceeds 3% after 50+ sends", () => {
    const result = shouldPauseCampaign(100, 4);
    expect(result.shouldPause).toBe(true);
    expect(result.bounceRate).toBe(0.04);
  });

  it("pauses at minimum threshold (50 sends, 2 bounces = 4%)", () => {
    const result = shouldPauseCampaign(50, 2);
    expect(result.shouldPause).toBe(true);
    expect(result.bounceRate).toBe(0.04);
  });

  it("does NOT pause at 49 sends even with high bounce rate", () => {
    const result = shouldPauseCampaign(49, 10);
    expect(result.shouldPause).toBe(false);
    // Rate is high but sample too small
    expect(result.bounceRate).toBeCloseTo(10 / 49, 5);
  });

  it("pauses at critical bounce rate (>5%)", () => {
    const result = shouldPauseCampaign(200, 12);
    expect(result.shouldPause).toBe(true);
    expect(result.bounceRate).toBe(0.06);
  });

  it("does NOT pause with healthy campaign (1% bounce)", () => {
    const result = shouldPauseCampaign(500, 5);
    expect(result.shouldPause).toBe(false);
    expect(result.bounceRate).toBe(0.01);
  });

  it("does NOT pause with zero bounces", () => {
    const result = shouldPauseCampaign(200, 0);
    expect(result.shouldPause).toBe(false);
    expect(result.bounceRate).toBe(0);
  });

  it("handles large campaign correctly", () => {
    // 10,000 sends, 350 bounces = 3.5%
    const result = shouldPauseCampaign(10000, 350);
    expect(result.shouldPause).toBe(true);
    expect(result.bounceRate).toBe(0.035);
  });

  it("handles edge case: 1 bounce in exactly 50 sends (2%) — no pause", () => {
    const result = shouldPauseCampaign(50, 1);
    expect(result.shouldPause).toBe(false);
    expect(result.bounceRate).toBe(0.02);
  });

  it("returns correct bounce rate even when not pausing due to min sends", () => {
    const result = shouldPauseCampaign(10, 5);
    expect(result.shouldPause).toBe(false);
    expect(result.bounceRate).toBe(0.5); // 50% but too few sends
  });
});

// ─── Real-world scenarios ───────────────────────────────

describe("real-world scenarios", () => {
  it("new campaign with first few bounces — no panic", () => {
    // Day 1: 20 emails sent, 3 bounced (15%) — don't pause yet, sample too small
    const result = shouldPauseCampaign(20, 3);
    expect(result.shouldPause).toBe(false);
  });

  it("campaign reaches 50 sends with clean list — no pause", () => {
    // 50 sends, 1 bounce (2%) — healthy
    const result = shouldPauseCampaign(50, 1);
    expect(result.shouldPause).toBe(false);
  });

  it("unverified list hitting ESP limits — auto-pause", () => {
    // 60 sends, 5 bounces (8.3%) — research says unverified lists avg 7.8% bounce
    const result = shouldPauseCampaign(60, 5);
    expect(result.shouldPause).toBe(true);
    expect(result.bounceRate).toBeCloseTo(0.083, 2);
  });

  it("slow-drip campaign with gradual bounce accumulation — pause when threshold crossed", () => {
    // 150 sends over 2 weeks, 5 bounces (3.3%) — just over threshold
    const result = shouldPauseCampaign(150, 5);
    expect(result.shouldPause).toBe(true);
    expect(result.bounceRate).toBeCloseTo(0.033, 2);
  });

  it("large verified campaign — healthy", () => {
    // 1000 sends, 8 bounces (0.8%) — well below threshold, verified list
    const result = shouldPauseCampaign(1000, 8);
    expect(result.shouldPause).toBe(false);
    expect(result.bounceRate).toBe(0.008);
  });
});
