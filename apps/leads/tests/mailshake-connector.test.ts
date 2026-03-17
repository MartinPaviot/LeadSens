import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  testMailshakeConnection,
  createMailshakeESP,
} from "@/server/lib/connectors/mailshake";

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

// ─── testMailshakeConnection ────────────────────────────

describe("testMailshakeConnection", () => {
  it("returns true when /me succeeds", async () => {
    mockFetch.mockReturnValue(Promise.resolve({ ok: true }));
    expect(await testMailshakeConnection("valid-key")).toBe(true);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/me");
    // Basic auth: base64("valid-key:")
    const expectedAuth = `Basic ${Buffer.from("valid-key:").toString("base64")}`;
    expect(options.headers.Authorization).toBe(expectedAuth);
  });

  it("returns false on HTTP error", async () => {
    mockFetch.mockReturnValue(Promise.resolve({ ok: false, status: 401 }));
    expect(await testMailshakeConnection("bad-key")).toBe(false);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    expect(await testMailshakeConnection("any-key")).toBe(false);
  });
});

// ─── ESP Provider ───────────────────────────────────────

describe("createMailshakeESP", () => {
  const esp = createMailshakeESP("test-key");

  it("has correct name", () => {
    expect(esp.name).toBe("mailshake");
  });

  describe("listAccounts", () => {
    it("maps senders correctly", async () => {
      mockFetch.mockReturnValue(okFetchResponse({
        results: [
          { id: 1, emailAddress: "sender@co.com", fromName: "Sender", isPaused: false },
          { id: 2, emailAddress: "backup@co.com", isPaused: true },
        ],
      }));

      const accounts = await esp.listAccounts();
      expect(accounts).toHaveLength(2);
      expect(accounts[0]).toEqual({
        email: "sender@co.com",
        name: "Sender",
        status: "active",
      });
      expect(accounts[1].status).toBe("paused");
    });

    it("returns empty array for missing results", async () => {
      mockFetch.mockReturnValue(okFetchResponse({}));
      expect(await esp.listAccounts()).toEqual([]);
    });
  });

  describe("createCampaign", () => {
    it("creates campaign with messages", async () => {
      mockFetch.mockReturnValue(okFetchResponse({ campaignID: 99, name: "Test" }));

      const result = await esp.createCampaign({
        name: "Test",
        steps: [
          { subject: "Hi", body: "Hello", delay: 0 },
          { subject: "Follow up", body: "Following up", delay: 3 },
        ],
        accountEmails: ["sender@co.com"],
      });

      expect(result.id).toBe("99");
      expect(result.name).toBe("Test");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages).toHaveLength(2);
      expect(body.senderEmailAddress).toBe("sender@co.com");
    });
  });

  describe("activateCampaign", () => {
    it("calls /campaigns/unpause", async () => {
      mockFetch.mockReturnValue(okFetchResponse({}));
      await esp.activateCampaign("99");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/campaigns/unpause");
      expect(JSON.parse(options.body).campaignID).toBe(99);
    });
  });

  describe("pauseCampaign", () => {
    it("calls /campaigns/pause", async () => {
      mockFetch.mockReturnValue(okFetchResponse({}));
      await esp.pauseCampaign("99");

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("/campaigns/pause");
    });
  });

  describe("getCampaignAnalytics", () => {
    it("maps analytics correctly", async () => {
      mockFetch.mockReturnValue(okFetchResponse({
        numSent: 200,
        numOpened: 80,
        numClicked: 15,
        numReplied: 10,
        numBounced: 5,
        numUnsubscribed: 2,
      }));

      const analytics = await esp.getCampaignAnalytics("99");
      expect(analytics.sent).toBe(200);
      expect(analytics.opened).toBe(80);
      expect(analytics.openRate).toBeCloseTo(0.4);
      expect(analytics.replied).toBe(10);
      expect(analytics.replyRate).toBeCloseTo(0.05);
    });

    it("handles zero sent gracefully", async () => {
      mockFetch.mockReturnValue(okFetchResponse({}));
      const analytics = await esp.getCampaignAnalytics("99");
      expect(analytics.sent).toBe(0);
      expect(analytics.openRate).toBeUndefined();
    });
  });

  describe("getStepAnalytics", () => {
    it("returns empty array (unsupported)", async () => {
      expect(await esp.getStepAnalytics("99")).toEqual([]);
    });
  });

  describe("addLeads", () => {
    it("sends recipients in correct format", async () => {
      mockFetch.mockReturnValue(okFetchResponse({ addedCount: 2, duplicateCount: 1 }));

      const result = await esp.addLeads("99", [
        { email: "a@a.com", firstName: "Alice", lastName: "A", company: "Acme" },
        { email: "b@b.com" },
      ]);

      expect(result.added).toBe(2);
      expect(result.skipped).toBe(1);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.recipients).toHaveLength(2);
      expect(body.campaignID).toBe(99);
    });
  });

  describe("getEmails", () => {
    it("fetches sent activity", async () => {
      mockFetch.mockReturnValue(okFetchResponse({
        results: [
          { id: 1, to: "lead@co.com", subject: "Hi", actionDate: "2026-01-01" },
        ],
      }));

      const result = await esp.getEmails({ campaignId: "99", emailType: "sent", limit: 10 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].to).toBe("lead@co.com");
    });

    it("returns empty for no campaignId", async () => {
      const result = await esp.getEmails({ limit: 10 });
      expect(result.items).toEqual([]);
    });
  });

  describe("replyToEmail", () => {
    it("returns unsupported error", async () => {
      const result = await esp.replyToEmail({
        emailId: "1",
        campaignId: "99",
        body: "Thanks",
      });
      expect(result.error).toContain("not supported");
    });
  });

  describe("disableVariant", () => {
    it("returns false (unsupported)", async () => {
      expect(await esp.disableVariant("99", 0, 0)).toBe(false);
    });
  });
});
