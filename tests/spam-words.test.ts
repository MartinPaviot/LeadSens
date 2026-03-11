import { describe, it, expect } from "vitest";
import {
  scanForSpamWords,
  SPAM_PHRASES,
  SPAM_WORDS,
  SPAM_THRESHOLD,
} from "@/server/lib/email/spam-words";

// ─── Word list completeness ─────────────────────────────────────

describe("spam word list", () => {
  it("has 100+ total trigger entries", () => {
    expect(SPAM_PHRASES.length + SPAM_WORDS.length).toBeGreaterThanOrEqual(100);
  });

  it("has no duplicate entries", () => {
    const all = [...SPAM_PHRASES, ...SPAM_WORDS];
    const unique = new Set(all);
    expect(unique.size).toBe(all.length);
  });

  it("all entries are lowercase", () => {
    const all = [...SPAM_PHRASES, ...SPAM_WORDS];
    for (const entry of all) {
      expect(entry).toBe(entry.toLowerCase());
    }
  });

  it("threshold is 3", () => {
    expect(SPAM_THRESHOLD).toBe(3);
  });
});

// ─── Scanner basics ─────────────────────────────────────────────

describe("scanForSpamWords", () => {
  it("returns 0 matches for a clean cold email", () => {
    const result = scanForSpamWords(
      "quick question about ops",
      "Hi Sarah,\n\nNoticed ShipFast expanded to Southeast Asia — congrats on the growth.\n\nWe help logistics teams cut last-mile costs by 30%. Worth a 10-min chat?\n\nBest,\nAlex",
    );
    expect(result.matchCount).toBe(0);
    expect(result.matches).toEqual([]);
    expect(result.flagged).toBe(false);
  });

  it("detects multi-word phrases", () => {
    const result = scanForSpamWords(
      "act now",
      "This is a limited time offer that expires today.",
    );
    expect(result.matches).toContain("act now");
    expect(result.matches).toContain("limited time");
    expect(result.matches).toContain("expires today");
    expect(result.matchCount).toBe(3);
    expect(result.flagged).toBe(true);
  });

  it("detects single words with word boundaries", () => {
    const result = scanForSpamWords(
      "urgent message",
      "Congratulations! You are the winner of our lottery!",
    );
    expect(result.matches).toContain("urgent");
    expect(result.matches).toContain("congratulations");
    expect(result.matches).toContain("winner");
    expect(result.matches).toContain("lottery");
    expect(result.matchCount).toBe(4);
    expect(result.flagged).toBe(true);
  });

  it("is case-insensitive", () => {
    const result = scanForSpamWords(
      "URGENT MESSAGE",
      "ACT NOW for this LIMITED TIME offer!",
    );
    expect(result.matches).toContain("urgent");
    expect(result.matches).toContain("act now");
    expect(result.matches).toContain("limited time");
    expect(result.flagged).toBe(true);
  });

  it("does not flag with fewer than threshold matches", () => {
    const result = scanForSpamWords(
      "quick question",
      "This is guaranteed to interest you.",
    );
    expect(result.matchCount).toBe(1);
    expect(result.matches).toContain("guaranteed");
    expect(result.flagged).toBe(false);
  });

  it("handles exact threshold (3 matches = flagged)", () => {
    const result = scanForSpamWords(
      "urgent",
      "This is guaranteed. Act now before it's too late.",
    );
    expect(result.matchCount).toBe(3);
    expect(result.flagged).toBe(true);
  });

  it("avoids false positives on partial word matches", () => {
    // "discount" should match as a single word
    // but "discovery" should NOT match "disco" (we don't have "disco" anyway)
    // "hiring" should NOT match "hi" — we check word boundaries
    const result = scanForSpamWords(
      "discovery call",
      "We're hiring ML engineers. Our team is building something innovative.",
    );
    expect(result.matchCount).toBe(0);
    expect(result.flagged).toBe(false);
  });

  it("scans both subject and body", () => {
    const result = scanForSpamWords(
      "act now — guaranteed",
      "This is a normal body.",
    );
    expect(result.matches).toContain("act now");
    expect(result.matches).toContain("guaranteed");
    expect(result.matchCount).toBe(2);
  });

  it("handles empty strings", () => {
    const result = scanForSpamWords("", "");
    expect(result.matchCount).toBe(0);
    expect(result.flagged).toBe(false);
  });

  it("counts each trigger only once even if it appears multiple times", () => {
    const result = scanForSpamWords(
      "urgent urgent urgent",
      "urgent message that is urgent",
    );
    // "urgent" should match only once (it's a single word check)
    expect(result.matches.filter((m) => m === "urgent")).toHaveLength(1);
  });
});

// ─── Real-world email scenarios ─────────────────────────────────

describe("real-world scenarios", () => {
  it("passes a well-written PAS cold email", () => {
    const result = scanForSpamWords(
      "logistics costs at shipfast",
      `Hi Sarah,

Noticed ShipFast just expanded to Southeast Asia — that usually means last-mile costs are top of mind.

We helped a similar logistics company cut delivery costs by 38% in 4 months using AI route optimization.

Worth a 10-min chat to see if there's a fit?

Best,
Alex`,
    );
    expect(result.flagged).toBe(false);
    expect(result.matchCount).toBe(0);
  });

  it("passes a value-add follow-up", () => {
    const result = scanForSpamWords(
      "thought you'd find this useful",
      `Hi Sarah,

Following up on my last note. Wanted to share this case study on how RetailCo reduced their delivery window from 48h to same-day.

Happy to walk you through how it could apply to ShipFast's Southeast Asia expansion.

Alex`,
    );
    expect(result.flagged).toBe(false);
  });

  it("flags a spammy email with financial promises", () => {
    const result = scanForSpamWords(
      "earn money with our system",
      `Dear Friend,

Congratulations! You've been selected for a risk-free opportunity to double your income.

Act now — this limited time offer won't last. Click here to get started!`,
    );
    expect(result.flagged).toBe(true);
    expect(result.matchCount).toBeGreaterThanOrEqual(6);
  });

  it("flags subtle spam (3+ triggers in professional-sounding email)", () => {
    const result = scanForSpamWords(
      "special offer for your team",
      `Hi Sarah,

I wanted to reach out about an exclusive deal we're running this month. It's guaranteed to save your team money.

This limited time promotion ends Friday.

Best,
Alex`,
    );
    expect(result.flagged).toBe(true);
    expect(result.matchCount).toBeGreaterThanOrEqual(3);
  });

  it("passes a breakup email", () => {
    const result = scanForSpamWords(
      "closing the loop",
      `Hi Sarah,

Looks like the timing isn't right. Totally understand.

If logistics optimization becomes a priority, I'm here.

All the best,
Alex`,
    );
    expect(result.flagged).toBe(false);
    expect(result.matchCount).toBe(0);
  });

  it("passes a social proof email", () => {
    const result = scanForSpamWords(
      "how retailco cut costs 38%",
      `Hi Sarah,

RetailCo's VP Ops faced the same scaling challenge when they expanded to 3 new markets.

After implementing our solution, they reduced last-mile costs by 38% and improved delivery SLA from 48h to same-day.

Happy to share specifics relevant to ShipFast.

Alex`,
    );
    expect(result.flagged).toBe(false);
  });
});
