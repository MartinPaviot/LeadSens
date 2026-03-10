import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
const mockReplyFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reply: {
      findFirst: (...args: unknown[]) => mockReplyFindFirst(...args),
    },
  },
}));

// Import AFTER mocks
import {
  isDuplicateReply,
  REPLY_DEDUP_WINDOW_MS,
} from "../src/server/lib/tools/pipeline-tools";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── REPLY_DEDUP_WINDOW_MS constant ─────────────────────

describe("REPLY_DEDUP_WINDOW_MS", () => {
  it("is 5 minutes in milliseconds", () => {
    expect(REPLY_DEDUP_WINDOW_MS).toBe(5 * 60 * 1000);
  });
});

// ─── isDuplicateReply ───────────────────────────────────

describe("isDuplicateReply", () => {
  const threadId = "thread-1";
  const body = "Thanks for reaching out! I'd love to learn more about your product.";

  it("returns false when no existing reply in thread", async () => {
    mockReplyFindFirst.mockResolvedValue(null);

    const result = await isDuplicateReply(threadId, body, "INBOUND");
    expect(result).toBe(false);
  });

  it("returns true when matching body exists in thread within window", async () => {
    mockReplyFindFirst.mockResolvedValue({ body });

    const result = await isDuplicateReply(threadId, body, "INBOUND");
    expect(result).toBe(true);
  });

  it("compares only first 100 characters of body", async () => {
    const longBody = "A".repeat(100) + " extra text that differs";
    const existingBody = "A".repeat(100) + " completely different ending";
    mockReplyFindFirst.mockResolvedValue({ body: existingBody });

    const result = await isDuplicateReply(threadId, longBody, "INBOUND");
    expect(result).toBe(true);
  });

  it("returns false when body prefix differs", async () => {
    mockReplyFindFirst.mockResolvedValue({ body: "Completely different reply" });

    const result = await isDuplicateReply(threadId, body, "INBOUND");
    expect(result).toBe(false);
  });

  it("queries with correct thread ID and direction", async () => {
    mockReplyFindFirst.mockResolvedValue(null);

    await isDuplicateReply("thread-xyz", body, "OUTBOUND");

    expect(mockReplyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          threadId: "thread-xyz",
          direction: "OUTBOUND",
        }),
      }),
    );
  });

  it("uses the dedup window for time filtering", async () => {
    mockReplyFindFirst.mockResolvedValue(null);

    const before = Date.now();
    await isDuplicateReply(threadId, body, "INBOUND");
    const after = Date.now();

    const call = mockReplyFindFirst.mock.calls[0][0];
    const gteDate = call.where.sentAt.gte as Date;
    const gteMs = gteDate.getTime();

    // The gte should be approximately (now - 5min)
    expect(gteMs).toBeGreaterThanOrEqual(before - REPLY_DEDUP_WINDOW_MS);
    expect(gteMs).toBeLessThanOrEqual(after - REPLY_DEDUP_WINDOW_MS);
  });

  it("handles empty body gracefully", async () => {
    mockReplyFindFirst.mockResolvedValue({ body: "" });

    const result = await isDuplicateReply(threadId, "", "INBOUND");
    expect(result).toBe(true);
  });

  it("returns false when existing body is empty but new body is not", async () => {
    mockReplyFindFirst.mockResolvedValue({ body: "" });

    const result = await isDuplicateReply(threadId, "New reply content", "INBOUND");
    expect(result).toBe(false);
  });

  it("exact match with short body (under 100 chars)", async () => {
    const shortBody = "Yes, let's talk!";
    mockReplyFindFirst.mockResolvedValue({ body: shortBody });

    const result = await isDuplicateReply(threadId, shortBody, "INBOUND");
    expect(result).toBe(true);
  });

  it("orders by sentAt desc to check most recent first", async () => {
    mockReplyFindFirst.mockResolvedValue(null);

    await isDuplicateReply(threadId, body, "INBOUND");

    expect(mockReplyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { sentAt: "desc" },
        select: { body: true },
      }),
    );
  });
});
