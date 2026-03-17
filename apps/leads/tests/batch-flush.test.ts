import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  flushLeadUpdates,
  DB_FLUSH_SIZE,
  type PendingLeadUpdate,
} from "@/server/lib/tools/enrichment-tools";

// ─── Mock Prisma ────────────────────────────────────────

const mockUpdate = vi.fn().mockResolvedValue({});
const mockTransaction = vi.fn().mockImplementation(async (ops: unknown[]) => {
  // Execute all PrismaPromise-like items (they're just the mock return values)
  return Promise.all(ops as Promise<unknown>[]);
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { update: (...args: unknown[]) => mockUpdate(...args) },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

// ─── Helpers ────────────────────────────────────────────

function makeUpdate(id: string): PendingLeadUpdate {
  return {
    id,
    data: { icpScore: 7, status: "SCORED" },
  };
}

// ─── Tests ──────────────────────────────────────────────

describe("DB_FLUSH_SIZE", () => {
  it("is 20", () => {
    expect(DB_FLUSH_SIZE).toBe(20);
  });
});

describe("flushLeadUpdates", () => {
  beforeEach(() => {
    mockUpdate.mockClear();
    mockTransaction.mockClear();
  });

  it("does nothing for empty array", async () => {
    const pending: PendingLeadUpdate[] = [];
    await flushLeadUpdates(pending);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("flushes a single update in one transaction", async () => {
    const pending = [makeUpdate("lead-1")];
    await flushLeadUpdates(pending);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    // $transaction receives an array of PrismaPromises (one per lead)
    const txArg = mockTransaction.mock.calls[0][0] as unknown[];
    expect(txArg).toHaveLength(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: { icpScore: 7, status: "SCORED" },
    });
  });

  it("flushes multiple updates in one transaction", async () => {
    const pending = [
      makeUpdate("lead-1"),
      makeUpdate("lead-2"),
      makeUpdate("lead-3"),
    ];
    await flushLeadUpdates(pending);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    const txArg = mockTransaction.mock.calls[0][0] as unknown[];
    expect(txArg).toHaveLength(3);
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });

  it("clears the pending array after flush", async () => {
    const pending = [makeUpdate("lead-1"), makeUpdate("lead-2")];
    await flushLeadUpdates(pending);
    expect(pending).toHaveLength(0);
  });

  it("passes correct data for each update", async () => {
    const pending: PendingLeadUpdate[] = [
      { id: "a", data: { icpScore: 3, status: "SKIPPED" } },
      { id: "b", data: { icpScore: 8, status: "SCORED" } },
    ];
    await flushLeadUpdates(pending);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "a" },
      data: { icpScore: 3, status: "SKIPPED" },
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "b" },
      data: { icpScore: 8, status: "SCORED" },
    });
  });

  it("propagates transaction errors", async () => {
    mockTransaction.mockRejectedValueOnce(new Error("DB connection lost"));
    const pending = [makeUpdate("lead-1")];

    await expect(flushLeadUpdates(pending)).rejects.toThrow("DB connection lost");
  });

  it("handles enrichment-style data with many fields", async () => {
    const pending: PendingLeadUpdate[] = [
      {
        id: "enrich-1",
        data: {
          enrichmentData: { companySummary: "A SaaS company" } as unknown as import("@prisma/client").Prisma.InputJsonValue,
          industry: "SaaS",
          companySize: "50-100",
          icpScore: 8.5,
          enrichmentCompleteness: 0.72,
          enrichedAt: new Date("2026-01-01"),
          status: "ENRICHED",
        },
      },
    ];
    await flushLeadUpdates(pending);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "enrich-1" },
      data: expect.objectContaining({
        industry: "SaaS",
        companySize: "50-100",
        icpScore: 8.5,
        enrichmentCompleteness: 0.72,
        status: "ENRICHED",
      }),
    });
  });

  it("can be called multiple times (simulating batch flushes)", async () => {
    const pending: PendingLeadUpdate[] = [];

    // First batch
    pending.push(makeUpdate("batch1-1"), makeUpdate("batch1-2"));
    await flushLeadUpdates(pending);
    expect(pending).toHaveLength(0);

    // Second batch
    pending.push(makeUpdate("batch2-1"));
    await flushLeadUpdates(pending);
    expect(pending).toHaveLength(0);

    expect(mockTransaction).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });
});

describe("batch flush integration pattern", () => {
  beforeEach(() => {
    mockUpdate.mockClear();
    mockTransaction.mockClear();
  });

  it("accumulate-and-flush reduces transaction count", async () => {
    const pending: PendingLeadUpdate[] = [];
    const totalLeads = 45;

    // Simulate the loop pattern used in score_leads_batch
    for (let i = 0; i < totalLeads; i++) {
      pending.push(makeUpdate(`lead-${i}`));
      if (pending.length >= DB_FLUSH_SIZE) {
        await flushLeadUpdates(pending);
      }
    }
    await flushLeadUpdates(pending);

    // 45 leads with flush size 20: 2 full batches (20+20) + 1 partial (5) = 3 transactions
    expect(mockTransaction).toHaveBeenCalledTimes(3);
    expect(mockUpdate).toHaveBeenCalledTimes(45);
  });

  it("exactly DB_FLUSH_SIZE leads = 1 transaction + 1 empty flush", async () => {
    const pending: PendingLeadUpdate[] = [];

    for (let i = 0; i < DB_FLUSH_SIZE; i++) {
      pending.push(makeUpdate(`lead-${i}`));
      if (pending.length >= DB_FLUSH_SIZE) {
        await flushLeadUpdates(pending);
      }
    }
    await flushLeadUpdates(pending); // empty — no-op

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(DB_FLUSH_SIZE);
  });

  it("fewer than DB_FLUSH_SIZE leads = 1 transaction at end", async () => {
    const pending: PendingLeadUpdate[] = [];

    for (let i = 0; i < 5; i++) {
      pending.push(makeUpdate(`lead-${i}`));
      if (pending.length >= DB_FLUSH_SIZE) {
        await flushLeadUpdates(pending);
      }
    }
    await flushLeadUpdates(pending);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(5);
  });

  it("errors skip failed leads without blocking batch", async () => {
    // Simulate: lead scoring fails for some, those don't get added to batch
    const pending: PendingLeadUpdate[] = [];
    const errorIds = new Set(["lead-3", "lead-7"]);
    let errors = 0;

    for (let i = 0; i < 10; i++) {
      const id = `lead-${i}`;
      if (errorIds.has(id)) {
        errors++;
        continue; // Skip failed leads — don't add to batch
      }
      pending.push(makeUpdate(id));
    }
    await flushLeadUpdates(pending);

    expect(errors).toBe(2);
    expect(mockUpdate).toHaveBeenCalledTimes(8);
  });
});
