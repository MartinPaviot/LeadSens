import { describe, it, expect, vi } from "vitest";
import { parseICP } from "@/server/lib/tools/icp-parser";

vi.mock("@/lib/ai-events", () => ({
  logAIEvent: vi.fn().mockResolvedValue(undefined),
  calculateCost: vi.fn().mockReturnValue(0),
}));

describe("ICP Parser — Vagueness Detection", () => {
  it("blocks ultra-short descriptions (pre-LLM)", async () => {
    const cases = [
      "test",
      "leads",
      "ceo",
      "France",
      "help me",
      "",
      "abc",
    ];
    for (const desc of cases) {
      const r = await parseICP(desc, "test");
      expect(r.clarificationNeeded, `Should block short: "${desc}"`).toBeTruthy();
    }
  }, 10_000);

  it("does not call LLM for ultra-short descriptions", async () => {
    const start = Date.now();
    const r = await parseICP("hello", "test");
    const elapsed = Date.now() - start;
    expect(r.clarificationNeeded).toBeTruthy();
    // Should be instant (< 50ms), not waiting for LLM call
    expect(elapsed).toBeLessThan(100);
  }, 10_000);

  it("blocks descriptions where LLM can't produce job_titles (post-LLM)", async () => {
    // These are long enough to pass the pre-check but too vague for the LLM
    // to generate meaningful job_titles
    const cases = [
      "des gens en France qui sont cool",
      "entreprises quelconques en Europe",
    ];
    for (const desc of cases) {
      const r = await parseICP(desc, "test");
      expect(r.clarificationNeeded, `Should block vague: "${desc}"`).toBeTruthy();
    }
  }, 60_000);

  it("allows complete descriptions (role + sector)", async () => {
    const cases = [
      "CTO de startups SaaS en France",
      "VP Marketing fintech London",
      "Directeur Commercial e-commerce PME",
      "RSSI des entreprises ameublement en Europe",
      "Head of Engineering at healthcare companies in US",
    ];
    for (const desc of cases) {
      const r = await parseICP(desc, "test");
      expect(r.clarificationNeeded, `Should allow: "${desc}"`).toBeFalsy();
    }
  }, 120_000);

  it("allows lookalike descriptions", async () => {
    const cases = [
      "entreprises similaires a doctolib.com",
      "companies like stripe.com",
    ];
    for (const desc of cases) {
      const r = await parseICP(desc, "test");
      expect(r.clarificationNeeded, `Should allow lookalike: "${desc}"`).toBeFalsy();
    }
  }, 120_000);

  it("returns a helpful clarification message", async () => {
    const r = await parseICP("short", "test");
    expect(r.clarificationNeeded).toBeTruthy();
    expect(r.clarificationNeeded).toContain("rôle");
    expect(r.clarificationNeeded).toContain("secteur");
  }, 10_000);
});
