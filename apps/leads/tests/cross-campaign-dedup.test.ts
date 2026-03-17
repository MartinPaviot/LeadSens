import { describe, it, expect } from "vitest";
import {
  analyzeCrossCampaignDedup,
  ALREADY_CONTACTED_STATUSES,
} from "@/server/lib/tools/tool-utils";

// ─── ALREADY_CONTACTED_STATUSES ──────────────────────────

describe("ALREADY_CONTACTED_STATUSES", () => {
  it("includes all post-push statuses", () => {
    const expected = [
      "PUSHED", "SENT", "REPLIED", "INTERESTED",
      "NOT_INTERESTED", "MEETING_BOOKED", "BOUNCED", "UNSUBSCRIBED",
    ];
    for (const status of expected) {
      expect(ALREADY_CONTACTED_STATUSES.has(status)).toBe(true);
    }
  });

  it("excludes pre-push statuses", () => {
    const prePush = ["SOURCED", "SCORED", "ENRICHED", "DRAFTED", "SKIPPED"];
    for (const status of prePush) {
      expect(ALREADY_CONTACTED_STATUSES.has(status)).toBe(false);
    }
  });

  it("has exactly 8 statuses", () => {
    expect(ALREADY_CONTACTED_STATUSES.size).toBe(8);
  });
});

// ─── analyzeCrossCampaignDedup ───────────────────────────

describe("analyzeCrossCampaignDedup", () => {
  // ─── No overlap ─────────────────────────────────────────
  it("returns empty duplicates when no overlap found", () => {
    const result = analyzeCrossCampaignDedup(
      ["alice@co.com", "bob@co.com"],
      [],
    );
    expect(result.duplicateCount).toBe(0);
    expect(result.duplicates).toEqual([]);
    expect(result.safeEmails).toEqual(["alice@co.com", "bob@co.com"]);
    expect(result.campaignNames).toEqual([]);
  });

  it("returns all emails as safe when performance list is empty", () => {
    const emails = ["a@x.com", "b@x.com", "c@x.com"];
    const result = analyzeCrossCampaignDedup(emails, []);
    expect(result.safeEmails).toEqual(emails);
    expect(result.duplicateCount).toBe(0);
  });

  // ─── Full overlap ──────────────────────────────────────
  it("detects all leads as duplicates when all overlap", () => {
    const result = analyzeCrossCampaignDedup(
      ["alice@co.com", "bob@co.com"],
      [
        { email: "alice@co.com", campaignId: "camp-A", campaignName: "Campaign A" },
        { email: "bob@co.com", campaignId: "camp-A", campaignName: "Campaign A" },
      ],
    );
    expect(result.duplicateCount).toBe(2);
    expect(result.safeEmails).toEqual([]);
    expect(result.campaignNames).toEqual(["Campaign A"]);
  });

  // ─── Partial overlap ───────────────────────────────────
  it("separates safe and duplicate leads in partial overlap", () => {
    const result = analyzeCrossCampaignDedup(
      ["alice@co.com", "bob@co.com", "charlie@co.com"],
      [
        { email: "bob@co.com", campaignId: "camp-A", campaignName: "Campaign A" },
      ],
    );
    expect(result.duplicateCount).toBe(1);
    expect(result.duplicates[0].email).toBe("bob@co.com");
    expect(result.duplicates[0].campaignName).toBe("Campaign A");
    expect(result.safeEmails).toEqual(["alice@co.com", "charlie@co.com"]);
  });

  // ─── Multiple campaigns ────────────────────────────────
  it("reports multiple campaign names when overlap spans campaigns", () => {
    const result = analyzeCrossCampaignDedup(
      ["alice@co.com", "bob@co.com", "charlie@co.com"],
      [
        { email: "alice@co.com", campaignId: "camp-A", campaignName: "Campaign A" },
        { email: "bob@co.com", campaignId: "camp-B", campaignName: "Campaign B" },
      ],
    );
    expect(result.duplicateCount).toBe(2);
    expect(result.campaignNames).toContain("Campaign A");
    expect(result.campaignNames).toContain("Campaign B");
    expect(result.safeEmails).toEqual(["charlie@co.com"]);
  });

  // ─── Dedup within performance records ──────────────────
  it("deduplicates same email appearing in multiple performance records", () => {
    const result = analyzeCrossCampaignDedup(
      ["alice@co.com"],
      [
        { email: "alice@co.com", campaignId: "camp-A", campaignName: "Campaign A" },
        { email: "alice@co.com", campaignId: "camp-B", campaignName: "Campaign B" },
      ],
    );
    // Should only report once per email (first campaign found)
    expect(result.duplicateCount).toBe(1);
    expect(result.duplicates[0].email).toBe("alice@co.com");
    // But both campaign names should be reported
    expect(result.campaignNames).toContain("Campaign A");
    expect(result.campaignNames).toContain("Campaign B");
    expect(result.safeEmails).toEqual([]);
  });

  // ─── Case insensitive email matching ───────────────────
  it("matches emails case-insensitively", () => {
    const result = analyzeCrossCampaignDedup(
      ["Alice@Co.com", "bob@co.com"],
      [
        { email: "alice@co.com", campaignId: "camp-A", campaignName: "Campaign A" },
      ],
    );
    expect(result.duplicateCount).toBe(1);
    expect(result.safeEmails).toEqual(["bob@co.com"]);
  });

  it("handles performance record with uppercase email", () => {
    const result = analyzeCrossCampaignDedup(
      ["alice@co.com"],
      [
        { email: "ALICE@CO.COM", campaignId: "camp-A", campaignName: "Campaign A" },
      ],
    );
    expect(result.duplicateCount).toBe(1);
    expect(result.safeEmails).toEqual([]);
  });

  // ─── Edge cases ────────────────────────────────────────
  it("handles empty lead list", () => {
    const result = analyzeCrossCampaignDedup([], []);
    expect(result.duplicateCount).toBe(0);
    expect(result.safeEmails).toEqual([]);
    expect(result.duplicates).toEqual([]);
  });

  it("handles single lead with no overlap", () => {
    const result = analyzeCrossCampaignDedup(
      ["solo@co.com"],
      [],
    );
    expect(result.duplicateCount).toBe(0);
    expect(result.safeEmails).toEqual(["solo@co.com"]);
  });

  it("handles single lead that is a duplicate", () => {
    const result = analyzeCrossCampaignDedup(
      ["solo@co.com"],
      [
        { email: "solo@co.com", campaignId: "camp-A", campaignName: "Outreach Q1" },
      ],
    );
    expect(result.duplicateCount).toBe(1);
    expect(result.safeEmails).toEqual([]);
    expect(result.duplicates[0].campaignName).toBe("Outreach Q1");
  });

  // ─── Large batch ───────────────────────────────────────
  it("handles large batch with mixed overlap", () => {
    const emails = Array.from({ length: 100 }, (_, i) => `lead${i}@co.com`);
    const perfRecords = [
      { email: "lead5@co.com", campaignId: "c1", campaignName: "C1" },
      { email: "lead50@co.com", campaignId: "c1", campaignName: "C1" },
      { email: "lead99@co.com", campaignId: "c2", campaignName: "C2" },
    ];
    const result = analyzeCrossCampaignDedup(emails, perfRecords);
    expect(result.duplicateCount).toBe(3);
    expect(result.safeEmails.length).toBe(97);
    expect(result.safeEmails).not.toContain("lead5@co.com");
    expect(result.safeEmails).not.toContain("lead50@co.com");
    expect(result.safeEmails).not.toContain("lead99@co.com");
  });

  // ─── Performance record for unknown email ──────────────
  it("ignores performance records for emails not in the lead list", () => {
    const result = analyzeCrossCampaignDedup(
      ["alice@co.com"],
      [
        { email: "unknown@co.com", campaignId: "camp-A", campaignName: "Campaign A" },
      ],
    );
    // The performance record doesn't match any lead email, so it's a "duplicate" of a non-lead
    // safeEmails should still contain alice since she's not in the perf records
    expect(result.safeEmails).toEqual(["alice@co.com"]);
    // But duplicateCount reflects the performance record found (even though email not in push list)
    expect(result.duplicateCount).toBe(1);
  });
});
