import { describe, it, expect } from "vitest";
import {
  scanForFillerPhrases,
  extractOpener,
  FILLER_PHRASES,
} from "@/server/lib/email/filler-phrases";

// ─── Phrase list quality ────────────────────────────────────────

describe("filler phrase list", () => {
  it("has 15+ phrases", () => {
    expect(FILLER_PHRASES.length).toBeGreaterThanOrEqual(15);
  });

  it("has no duplicates", () => {
    const unique = new Set(FILLER_PHRASES);
    expect(unique.size).toBe(FILLER_PHRASES.length);
  });

  it("all entries are lowercase", () => {
    for (const phrase of FILLER_PHRASES) {
      expect(phrase).toBe(phrase.toLowerCase());
    }
  });
});

// ─── Opener extraction ──────────────────────────────────────────

describe("extractOpener", () => {
  it("skips greeting line and returns first 2 sentences", () => {
    const body = `Hi Sarah,

Noticed ShipFast expanded to Southeast Asia. That usually means last-mile costs are top of mind.

We help logistics teams cut costs by 30%.`;

    const opener = extractOpener(body);
    expect(opener).toContain("noticed shipfast expanded");
    expect(opener).toContain("last-mile costs");
    // Should NOT include the third sentence
    expect(opener).not.toContain("we help logistics");
  });

  it("handles Hey/Hello/Dear greetings", () => {
    const body = `Hey Marc,

I came across your profile on LinkedIn. Wanted to connect about your growth plans.`;

    const opener = extractOpener(body);
    expect(opener).toContain("i came across your profile");
    expect(opener).not.toContain("hey marc");
  });

  it("handles body without greeting", () => {
    const body = `Noticed you just raised Series B. That changes the hiring game.`;
    const opener = extractOpener(body);
    expect(opener).toContain("noticed you just raised");
  });

  it("handles single-sentence body", () => {
    const body = `Hi Sarah,

Just one short sentence.`;
    const opener = extractOpener(body);
    expect(opener).toContain("just one short sentence");
  });

  it("handles empty body", () => {
    const opener = extractOpener("");
    expect(opener).toBe("");
  });

  it("handles question marks and exclamation marks as sentence enders", () => {
    const body = `Hi Sarah,

Have you considered automating your outreach? Most VP Sales save 10 hours per week. Here's how we helped RetailCo.`;
    const opener = extractOpener(body, 2);
    expect(opener).toContain("have you considered");
    expect(opener).toContain("most vp sales");
    expect(opener).not.toContain("retailco");
  });
});

// ─── Scanner basics ─────────────────────────────────────────────

describe("scanForFillerPhrases", () => {
  it("flags 'I came across your profile' in opener", () => {
    const body = `Hi Sarah,

I came across your profile on LinkedIn and wanted to connect. Your work in logistics is impressive.`;

    const result = scanForFillerPhrases(body);
    expect(result.flagged).toBe(true);
    expect(result.matches).toContain("i came across your profile");
  });

  it("flags 'I hope this finds you well'", () => {
    const body = `Hi Sarah,

I hope this finds you well. I wanted to discuss an opportunity.`;

    const result = scanForFillerPhrases(body);
    expect(result.flagged).toBe(true);
    expect(result.matches).toContain("i hope this finds you well");
  });

  it("flags 'I admire what you're building'", () => {
    const body = `Dear Marc,

I admire what you're building at TechCorp. Your team has done amazing work.`;

    const result = scanForFillerPhrases(body);
    expect(result.flagged).toBe(true);
    expect(result.matches).toContain("i admire what you're building");
  });

  it("flags 'just wanted to reach out'", () => {
    const body = `Hi Sarah,

Just wanted to reach out about something that might interest you. We work with logistics teams.`;

    const result = scanForFillerPhrases(body);
    expect(result.flagged).toBe(true);
    expect(result.matches).toContain("just wanted to reach out");
  });

  it("flags 'love what you're doing'", () => {
    const body = `Hey Marc,

Love what you're doing at ShipFast! Would love to chat about growth.`;

    const result = scanForFillerPhrases(body);
    expect(result.flagged).toBe(true);
    expect(result.matches).toContain("love what you're doing");
  });

  it("flags 'just checking in' (follow-up filler)", () => {
    const body = `Hi Sarah,

Just checking in on my previous email. Any thoughts?`;

    const result = scanForFillerPhrases(body);
    expect(result.flagged).toBe(true);
    expect(result.matches).toContain("just checking in");
  });

  it("detects multiple filler phrases in same opener", () => {
    const body = `Hi Sarah,

I hope this finds you well. I came across your company and wanted to connect.`;

    const result = scanForFillerPhrases(body);
    expect(result.flagged).toBe(true);
    expect(result.matchCount).toBeGreaterThanOrEqual(2);
    expect(result.matches).toContain("i hope this finds you well");
    expect(result.matches).toContain("i came across your company");
  });

  it("is case-insensitive", () => {
    const body = `Hi Sarah,

I CAME ACROSS YOUR PROFILE on LinkedIn. Let me share something.`;

    const result = scanForFillerPhrases(body);
    expect(result.flagged).toBe(true);
    expect(result.matches).toContain("i came across your profile");
  });

  it("does NOT flag specific signal openers", () => {
    const body = `Hi Sarah,

Noticed ShipFast just expanded to Southeast Asia — that usually means last-mile costs are top of mind.

We helped RetailCo cut delivery costs by 38%.`;

    const result = scanForFillerPhrases(body);
    expect(result.flagged).toBe(false);
    expect(result.matchCount).toBe(0);
  });

  it("does NOT flag specific trigger openers", () => {
    const body = `Hi Marc,

Your Series B announcement caught my eye. Scaling from 30 to 100 engineers usually creates pipeline bottlenecks.`;

    const result = scanForFillerPhrases(body);
    expect(result.flagged).toBe(false);
    expect(result.matchCount).toBe(0);
  });

  it("does NOT flag filler phrases deep in the body (after sentence 2)", () => {
    const body = `Hi Sarah,

Noticed ShipFast expanded to 3 new markets. That usually means logistics costs are spiking.

I came across your profile and thought this might help. We work with similar companies.`;

    const result = scanForFillerPhrases(body);
    // "I came across your profile" is in sentence 3+, should NOT be flagged
    expect(result.flagged).toBe(false);
  });

  it("passes a well-written PAS cold email", () => {
    const body = `Hi Sarah,

ShipFast's Southeast Asia expansion is bold — most logistics companies see 40% cost spikes in new markets during the first 6 months.

We helped RetailCo navigate the same challenge and cut their last-mile costs by 38%.

Worth a 10-min chat?`;

    const result = scanForFillerPhrases(body);
    expect(result.flagged).toBe(false);
  });

  it("passes a value-add follow-up", () => {
    const body = `Hi Sarah,

Sharing a case study that maps to ShipFast's current challenge — RetailCo reduced their delivery window from 48h to same-day after expanding to 3 markets.

Happy to walk you through how it applies to your Southeast Asia rollout.`;

    const result = scanForFillerPhrases(body);
    expect(result.flagged).toBe(false);
  });

  it("passes a breakup email", () => {
    const body = `Hi Sarah,

Looks like the timing isn't right. Totally understand.

If logistics optimization becomes a priority, I'm here.`;

    const result = scanForFillerPhrases(body);
    expect(result.flagged).toBe(false);
  });

  it("handles empty body", () => {
    const result = scanForFillerPhrases("");
    expect(result.flagged).toBe(false);
    expect(result.matchCount).toBe(0);
    expect(result.matches).toEqual([]);
  });
});
