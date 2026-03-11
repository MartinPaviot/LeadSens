import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  testReplyIoConnection,
  createReplyIoESP,
} from "@/server/lib/connectors/reply-io";

// ─── Mock fetch ─────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function okFetchResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: { get: (h: string) => h === "content-type" ? "application/json" : null },
  });
}

// ─── testReplyIoConnection ──────────────────────────────

describe("testReplyIoConnection", () => {
  it("returns true when emailAccounts succeeds", async () => {
    mockFetch.mockReturnValue(Promise.resolve({ ok: true }));
    expect(await testReplyIoConnection("valid-key")).toBe(true);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/v2/emailAccounts");
    expect(options.headers["x-api-key"]).toBe("valid-key");
  });

  it("returns false on HTTP error", async () => {
    mockFetch.mockReturnValue(Promise.resolve({ ok: false, status: 401 }));
    expect(await testReplyIoConnection("bad-key")).toBe(false);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    expect(await testReplyIoConnection("any-key")).toBe(false);
  });
});

// ─── ESP Provider ───────────────────────────────────────

describe("createReplyIoESP", () => {
  const esp = createReplyIoESP("test-key");

  it("has correct name", () => {
    expect(esp.name).toBe("reply_io");
  });

  describe("listAccounts", () => {
    it("maps accounts correctly", async () => {
      mockFetch.mockReturnValue(okFetchResponse([
        { id: 1, email: "sender@co.com", name: "Sender", isActive: true, dailyLimit: 100 },
        { id: 2, email: "backup@co.com", isActive: false },
      ]));

      const accounts = await esp.listAccounts();
      expect(accounts).toHaveLength(2);
      expect(accounts[0]).toEqual({
        email: "sender@co.com",
        name: "Sender",
        status: "active",
        dailySendLimit: 100,
      });
      expect(accounts[1].status).toBe("inactive");
    });
  });

  describe("createCampaign", () => {
    it("creates campaign and adds steps", async () => {
      mockFetch
        // Create campaign
        .mockReturnValueOnce(okFetchResponse({ id: 77, name: "Test Campaign" }))
        // Add step 1
        .mockReturnValueOnce(okFetchResponse({}))
        // Add step 2
        .mockReturnValueOnce(okFetchResponse({}));

      const result = await esp.createCampaign({
        name: "Test Campaign",
        steps: [
          { subject: "Hi", body: "Hello", delay: 0 },
          { subject: "Follow up", body: "Following up", delay: 3 },
        ],
        accountEmails: [],
      });

      expect(result.id).toBe("77");
      expect(result.name).toBe("Test Campaign");
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Verify step 2 has correct delay
      const step2Body = JSON.parse(mockFetch.mock.calls[2][1].body);
      expect(step2Body.delay).toBe(3);
      expect(step2Body.delayUnit).toBe("day");
    });
  });

  describe("activateCampaign", () => {
    it("calls PUT /campaigns/{id}/start", async () => {
      mockFetch.mockReturnValue(okFetchResponse({}));
      await esp.activateCampaign("77");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/campaigns/77/start");
      expect(options.method).toBe("PUT");
    });
  });

  describe("pauseCampaign", () => {
    it("calls PUT /campaigns/{id}/pause", async () => {
      mockFetch.mockReturnValue(okFetchResponse({}));
      await esp.pauseCampaign("77");

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("/campaigns/77/pause");
    });
  });

  describe("getCampaignAnalytics", () => {
    it("maps analytics correctly", async () => {
      mockFetch.mockReturnValue(okFetchResponse({
        sent: 300,
        opened: 120,
        clicked: 20,
        replied: 15,
        bounced: 3,
        unsubscribed: 1,
      }));

      const analytics = await esp.getCampaignAnalytics("77");
      expect(analytics.sent).toBe(300);
      expect(analytics.opened).toBe(120);
      expect(analytics.openRate).toBeCloseTo(0.4);
      expect(analytics.replied).toBe(15);
      expect(analytics.replyRate).toBeCloseTo(0.05);
      expect(analytics.bounced).toBe(3);
    });

    it("handles zero sent", async () => {
      mockFetch.mockReturnValue(okFetchResponse({}));
      const analytics = await esp.getCampaignAnalytics("77");
      expect(analytics.sent).toBe(0);
      expect(analytics.openRate).toBeUndefined();
    });
  });

  describe("getStepAnalytics", () => {
    it("maps step analytics with 1-indexed to 0-indexed", async () => {
      mockFetch.mockReturnValue(okFetchResponse({
        steps: [
          { stepNumber: 1, sent: 100, opened: 50, replied: 5, bounced: 2 },
          { stepNumber: 2, sent: 80, opened: 30, replied: 3, bounced: 1 },
        ],
      }));

      const steps = await esp.getStepAnalytics("77");
      expect(steps).toHaveLength(2);
      expect(steps[0].step).toBe(0);
      expect(steps[0].sent).toBe(100);
      expect(steps[1].step).toBe(1);
    });

    it("returns empty array when no steps", async () => {
      mockFetch.mockReturnValue(okFetchResponse({}));
      expect(await esp.getStepAnalytics("77")).toEqual([]);
    });
  });

  describe("addLeads", () => {
    it("sends people in correct format", async () => {
      mockFetch.mockReturnValue(okFetchResponse({ added: 2, duplicates: 0 }));

      const result = await esp.addLeads("77", [
        { email: "a@a.com", firstName: "Alice", lastName: "A", company: "Acme" },
        { email: "b@b.com", firstName: "Bob" },
      ]);

      expect(result.added).toBe(2);
      expect(result.skipped).toBe(0);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.people).toHaveLength(2);
      expect(body.people[0].email).toBe("a@a.com");
    });
  });

  describe("replyToEmail", () => {
    it("sends reply via API (supported!)", async () => {
      mockFetch.mockReturnValue(okFetchResponse({ id: "reply-123" }));

      const result = await esp.replyToEmail({
        emailId: "email-1",
        campaignId: "77",
        body: "Thanks for your interest!",
      });

      expect(result.id).toBe("reply-123");
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/activities/reply");
      const body = JSON.parse(options.body);
      expect(body.body).toBe("Thanks for your interest!");
    });

    it("returns error on failure", async () => {
      mockFetch.mockRejectedValue(new Error("Reply.io API error"));

      const result = await esp.replyToEmail({
        emailId: "email-1",
        campaignId: "77",
        body: "Thanks",
      });

      expect(result.error).toContain("Reply.io API error");
    });
  });

  describe("removeFromSequence", () => {
    it("finds person by email then deletes", async () => {
      mockFetch
        // Find person
        .mockReturnValueOnce(okFetchResponse([{ id: 555 }]))
        // Delete
        .mockReturnValueOnce(okFetchResponse({}));

      const result = await esp.removeFromSequence({
        leadEmail: "lead@co.com",
        campaignId: "77",
        reason: "interested",
      });

      expect(result.removed).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[1][0]).toContain("/people/555");
      expect(mockFetch.mock.calls[1][1].method).toBe("DELETE");
    });

    it("returns error when person not found", async () => {
      mockFetch.mockReturnValue(okFetchResponse([]));

      const result = await esp.removeFromSequence({
        leadEmail: "unknown@co.com",
        campaignId: "77",
        reason: "not_interested",
      });

      expect(result.removed).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("disableVariant", () => {
    it("returns false (unsupported)", async () => {
      expect(await esp.disableVariant("77", 0, 0)).toBe(false);
    });
  });

  describe("getEmails", () => {
    it("fetches activities with filters", async () => {
      mockFetch.mockReturnValue(okFetchResponse([
        { id: 1, from: "sender@co.com", to: "lead@co.com", subject: "Hi", createdAt: "2026-01-01" },
      ]));

      const result = await esp.getEmails({ campaignId: "77", emailType: "sent", limit: 10 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].from).toBe("sender@co.com");

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("campaignId=77");
      expect(url).toContain("type=sent");
    });
  });
});
