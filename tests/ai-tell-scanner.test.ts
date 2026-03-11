import { describe, it, expect } from "vitest";
import { scanForAiTells } from "@/server/lib/email/ai-tell-scanner";

describe("scanForAiTells", () => {
  // ─── Formal tells ──────────────────────────────────────

  it("flags formal language: 'I would like to'", () => {
    const result = scanForAiTells("I would like to discuss an opportunity with you.");
    expect(result.flagged).toBe(true);
    expect(result.category).toBe("formal");
    expect(result.matches).toContain("i would like to");
  });

  it("flags 'I am writing to'", () => {
    const result = scanForAiTells("I am writing to introduce our platform.");
    expect(result.flagged).toBe(true);
    expect(result.category).toBe("formal");
  });

  it("flags 'please do not hesitate'", () => {
    const result = scanForAiTells("Please do not hesitate to reach out if interested.");
    expect(result.flagged).toBe(true);
    expect(result.category).toBe("formal");
  });

  it("flags 'furthermore'", () => {
    const result = scanForAiTells("Our tool saves time. Furthermore, it reduces costs significantly.");
    expect(result.flagged).toBe(true);
    expect(result.category).toBe("formal");
  });

  it("flags 'moreover'", () => {
    const result = scanForAiTells("We offer support. Moreover, our team is available 24/7.");
    expect(result.flagged).toBe(true);
    expect(result.category).toBe("formal");
  });

  // ─── Corporate buzzwords ───────────────────────────────

  it("flags 2+ corporate buzzwords", () => {
    const result = scanForAiTells("Our innovative and scalable platform helps teams grow.");
    expect(result.flagged).toBe(true);
    expect(result.category).toBe("corporate");
    expect(result.matches.length).toBeGreaterThanOrEqual(2);
  });

  it("does NOT flag a single buzzword", () => {
    const result = scanForAiTells("We built a scalable solution for your team.");
    expect(result.flagged).toBe(false);
  });

  it("flags world-class + cutting-edge combo", () => {
    const result = scanForAiTells("Our world-class team delivers cutting-edge solutions.");
    expect(result.flagged).toBe(true);
    expect(result.category).toBe("corporate");
  });

  // ─── Repetitive structure ──────────────────────────────

  it("flags 3 consecutive 'We' sentences", () => {
    const body = "We help teams scale. We reduce costs by 40%. We provide 24/7 support. Want to learn more?";
    const result = scanForAiTells(body);
    expect(result.flagged).toBe(true);
    expect(result.category).toBe("repetitive");
  });

  it("flags 3 consecutive 'Our' sentences", () => {
    const body = "Our platform is fast. Our customers love it. Our team is dedicated. Should we chat?";
    const result = scanForAiTells(body);
    expect(result.flagged).toBe(true);
    expect(result.category).toBe("repetitive");
  });

  it("does NOT flag 2 consecutive 'We' sentences", () => {
    const body = "We help teams scale. We reduce costs by 40%. What's your biggest challenge right now?";
    const result = scanForAiTells(body);
    expect(result.flagged).toBe(false);
  });

  it("does NOT flag non-consecutive 'We' sentences", () => {
    const body = "We help teams scale. Your challenge is pipeline. We reduce costs by 40%. Interesting?";
    const result = scanForAiTells(body);
    expect(result.flagged).toBe(false);
  });

  // ─── Clean emails ─────────────────────────────────────

  it("passes a natural, specific email", () => {
    const result = scanForAiTells(
      "Since you expanded your SDR team by 3, pipeline gen probably isn't keeping pace. " +
      "That's exactly the gap we closed for Datadog — 2x pipeline in 90 days. Worth a quick look?"
    );
    expect(result.flagged).toBe(false);
  });

  it("passes a short casual email", () => {
    const result = scanForAiTells(
      "Saw your Series B — congrats. Usually means the next hire is a VP Sales. " +
      "If that's on your radar, happy to share how we helped 3 similar teams ramp in 60 days."
    );
    expect(result.flagged).toBe(false);
  });

  it("passes an empty body", () => {
    const result = scanForAiTells("");
    expect(result.flagged).toBe(false);
  });

  // ─── Case insensitivity ────────────────────────────────

  it("detects formal tells case-insensitively", () => {
    const result = scanForAiTells("I Would Like To propose a partnership.");
    expect(result.flagged).toBe(true);
    expect(result.category).toBe("formal");
  });
});
