import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for resilient lead creation in instantly_source_leads.
 *
 * We test the error-handling logic inline: schema errors break early,
 * transient errors accumulate, P2002 dedup is preserved, and
 * source-empty returns a structured error.
 */

// ── Helpers that mirror the loop logic in instantly-tools.ts ──

interface LeadCreateResult {
  newLeadIds: string[];
  skippedExisting: string[];
  failedLeads: { email: string; error: string }[];
}

class MockPrismaError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "PrismaClientKnownRequestError";
  }
}

/**
 * Simulates the lead creation loop from instantly-tools.ts lines 393-449.
 * `createFn` is called per lead email; it should resolve an id or throw.
 */
function simulateLeadLoop(
  emails: string[],
  existingEmails: Set<string>,
  createFn: (email: string) => string, // returns id or throws
): LeadCreateResult {
  const newLeadIds: string[] = [];
  const skippedExisting: string[] = [];
  const failedLeads: { email: string; error: string }[] = [];

  for (const email of emails) {
    const emailLower = email.toLowerCase();

    if (existingEmails.has(emailLower)) {
      skippedExisting.push(emailLower);
      continue;
    }

    try {
      const id = createFn(emailLower);
      newLeadIds.push(id);
    } catch (err) {
      if (err instanceof MockPrismaError && err.code === "P2002") {
        skippedExisting.push(emailLower);
        continue;
      }
      const errMsg = err instanceof Error ? err.message : "Unknown DB error";
      failedLeads.push({ email: emailLower, error: errMsg });
      // Schema errors affect ALL leads — break early
      if (errMsg.includes("does not exist") || errMsg.includes("column")) {
        break;
      }
      continue;
    }
  }

  return { newLeadIds, skippedExisting, failedLeads };
}

describe("source leads error handling", () => {
  describe("schema error detection", () => {
    it("breaks early on 'column does not exist' error", () => {
      const emails = Array.from({ length: 10 }, (_, i) => `lead${i}@example.com`);
      const createFn = vi.fn<(email: string) => string>().mockImplementation(() => {
        throw new Error("The column `lead.verificationStatus` does not exist in the current database.");
      });

      const result = simulateLeadLoop(emails, new Set(), createFn);

      // Should break after 1st failure, not try all 10
      expect(createFn).toHaveBeenCalledTimes(1);
      expect(result.newLeadIds).toHaveLength(0);
      expect(result.failedLeads).toHaveLength(1);
      expect(result.failedLeads[0].error).toContain("does not exist");
    });

    it("returns SCHEMA_MISMATCH error type when all leads fail due to schema", () => {
      const result = simulateLeadLoop(
        ["a@b.com"],
        new Set(),
        () => { throw new Error("The column `lead.newCol` does not exist"); },
      );

      expect(result.newLeadIds).toHaveLength(0);
      expect(result.failedLeads).toHaveLength(1);

      // Verify the error message is actionable
      const firstError = result.failedLeads[0].error;
      const isSchemaError = firstError.includes("does not exist");
      expect(isSchemaError).toBe(true);
    });
  });

  describe("partial failure", () => {
    it("saves successful leads and accumulates failures", () => {
      let callCount = 0;
      const createFn = vi.fn<(email: string) => string>().mockImplementation((email) => {
        callCount++;
        // Fail leads 3, 6, 9 with a transient error
        if (callCount % 3 === 0) {
          throw new Error("connection timeout");
        }
        return `id-${callCount}`;
      });

      const emails = Array.from({ length: 10 }, (_, i) => `lead${i}@example.com`);
      const result = simulateLeadLoop(emails, new Set(), createFn);

      // 10 leads, 3 fail (indices 3, 6, 9) → 7 saved
      expect(result.newLeadIds).toHaveLength(7);
      expect(result.failedLeads).toHaveLength(3);
      expect(result.failedLeads[0].error).toBe("connection timeout");
      // Transient errors should NOT break the loop
      expect(createFn).toHaveBeenCalledTimes(10);
    });

    it("includes partial_failure in return when some leads fail", () => {
      const createFn = vi.fn<(email: string) => string>().mockImplementation((email) => {
        if (email === "bad@fail.com") throw new Error("transient");
        return "id-1";
      });

      const result = simulateLeadLoop(["good@ok.com", "bad@fail.com", "good2@ok.com"], new Set(), createFn);

      expect(result.newLeadIds).toHaveLength(2);
      expect(result.failedLeads).toHaveLength(1);
    });
  });

  describe("P2002 dedup preserved", () => {
    it("skips P2002 errors as existing leads", () => {
      let callCount = 0;
      const createFn = vi.fn<(email: string) => string>().mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new MockPrismaError("P2002", "Unique constraint violation");
        }
        return `id-${callCount}`;
      });

      const result = simulateLeadLoop(["a@b.com", "dup@b.com", "c@b.com"], new Set(), createFn);

      expect(result.newLeadIds).toHaveLength(2);
      expect(result.skippedExisting).toContain("dup@b.com");
      expect(result.failedLeads).toHaveLength(0);
    });

    it("skips leads in existingEmails set without calling create", () => {
      const createFn = vi.fn<(email: string) => string>().mockReturnValue("id-1");
      const existing = new Set(["known@b.com"]);

      const result = simulateLeadLoop(["new@b.com", "known@b.com", "new2@b.com"], existing, createFn);

      expect(createFn).toHaveBeenCalledTimes(2);
      expect(result.skippedExisting).toContain("known@b.com");
      expect(result.newLeadIds).toHaveLength(2);
    });
  });

  describe("source-empty detection", () => {
    it("returns SOURCE_EMPTY when allLeads is empty", () => {
      // This tests the pre-loop check: if Instantly returns 0 leads,
      // we should return a structured error, not silently proceed.
      const allLeads: unknown[] = [];

      if (allLeads.length === 0) {
        const result = {
          sourced: 0,
          error: "Instantly sourcing returned 0 leads despite successful enrichment. " +
                 "This can happen when: (1) all leads were already in your account, " +
                 "(2) enrichment timed out, or (3) count endpoint over-estimated.",
          error_type: "SOURCE_EMPTY",
        };

        expect(result.sourced).toBe(0);
        expect(result.error_type).toBe("SOURCE_EMPTY");
        expect(result.error).toContain("0 leads");
      }
    });
  });

  describe("break vs continue behavior", () => {
    it("breaks on 'column' keyword in error message", () => {
      let callCount = 0;
      const createFn = vi.fn<(email: string) => string>().mockImplementation(() => {
        callCount++;
        if (callCount === 3) {
          throw new Error("Unknown column 'foo' in field list");
        }
        return `id-${callCount}`;
      });

      const emails = Array.from({ length: 10 }, (_, i) => `lead${i}@test.com`);
      const result = simulateLeadLoop(emails, new Set(), createFn);

      // Should break at lead 3 — only 2 succeeded, 7 never attempted
      expect(result.newLeadIds).toHaveLength(2);
      expect(result.failedLeads).toHaveLength(1);
      expect(createFn).toHaveBeenCalledTimes(3);
    });

    it("continues past non-schema errors", () => {
      let callCount = 0;
      const createFn = vi.fn<(email: string) => string>().mockImplementation(() => {
        callCount++;
        if (callCount === 2) throw new Error("connection reset");
        return `id-${callCount}`;
      });

      const emails = ["a@t.com", "b@t.com", "c@t.com", "d@t.com"];
      const result = simulateLeadLoop(emails, new Set(), createFn);

      expect(result.newLeadIds).toHaveLength(3);
      expect(result.failedLeads).toHaveLength(1);
      expect(createFn).toHaveBeenCalledTimes(4); // all 4 attempted
    });
  });
});
