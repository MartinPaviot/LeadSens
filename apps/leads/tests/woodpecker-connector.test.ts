import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  testWoodpeckerConnection,
  createWoodpeckerESP,
} from "@/server/lib/connectors/woodpecker";

// ─── Mock fetch ─────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function okResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: new Map([["content-type", "application/json"]]),
  });
}

function errorResponse(status: number) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve("error"),
  });
}

// Woodpecker uses x-api-key header
function okFetchResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: { get: (h: string) => h === "content-type" ? "application/json" : null },
  });
}

// ─── testWoodpeckerConnection ───────────────────────────

describe("testWoodpeckerConnection", () => {
  it("returns true when mail_accounts succeeds", async () => {
    mockFetch.mockReturnValue(Promise.resolve({ ok: true }));
    expect(await testWoodpeckerConnection("valid-key")).toBe(true);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/rest/v2/mail_accounts");
    expect(options.headers["x-api-key"]).toBe("valid-key");
  });

  it("returns false on HTTP error", async () => {
    mockFetch.mockReturnValue(Promise.resolve({ ok: false, status: 401 }));
    expect(await testWoodpeckerConnection("bad-key")).toBe(false);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    expect(await testWoodpeckerConnection("any-key")).toBe(false);
  });
});

// ─── ESP Provider ───────────────────────────────────────

describe("createWoodpeckerESP", () => {
  const esp = createWoodpeckerESP("test-key");

  it("has correct name", () => {
    expect(esp.name).toBe("woodpecker");
  });

  describe("listAccounts", () => {
    it("maps accounts correctly", async () => {
      mockFetch.mockReturnValue(okFetchResponse([
        { id: 1, email: "sender@co.com", name: "Sender", is_connected: true, daily_limit: 50 },
        { id: 2, email: "backup@co.com", is_connected: false },
      ]));

      const accounts = await esp.listAccounts();
      expect(accounts).toHaveLength(2);
      expect(accounts[0]).toEqual({
        email: "sender@co.com",
        name: "Sender",
        status: "active",
        dailySendLimit: 50,
      });
      expect(accounts[1].status).toBe("inactive");
    });
  });

  describe("createCampaign", () => {
    it("creates campaign and adds steps", async () => {
      mockFetch
        // Create campaign
        .mockReturnValueOnce(okFetchResponse({ id: 42, name: "Test Campaign" }))
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

      expect(result.id).toBe("42");
      expect(result.name).toBe("Test Campaign");
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("activateCampaign", () => {
    it("sends PATCH with status active", async () => {
      mockFetch.mockReturnValue(okFetchResponse({}));
      await esp.activateCampaign("42");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/campaigns/42");
      expect(options.method).toBe("PATCH");
      expect(JSON.parse(options.body).status).toBe("active");
    });
  });

  describe("pauseCampaign", () => {
    it("sends PATCH with status paused", async () => {
      mockFetch.mockReturnValue(okFetchResponse({}));
      await esp.pauseCampaign("42");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.status).toBe("paused");
    });
  });

  describe("getCampaignAnalytics", () => {
    it("maps analytics correctly", async () => {
      mockFetch.mockReturnValue(okFetchResponse({
        sent: 100,
        opened: 50,
        clicked: 10,
        replied: 5,
        bounced: 2,
        unsubscribed: 1,
      }));

      const analytics = await esp.getCampaignAnalytics("42");
      expect(analytics.sent).toBe(100);
      expect(analytics.opened).toBe(50);
      expect(analytics.openRate).toBeCloseTo(0.5);
      expect(analytics.replied).toBe(5);
      expect(analytics.replyRate).toBeCloseTo(0.05);
      expect(analytics.bounced).toBe(2);
    });

    it("handles zero sent gracefully", async () => {
      mockFetch.mockReturnValue(okFetchResponse({}));
      const analytics = await esp.getCampaignAnalytics("42");
      expect(analytics.sent).toBe(0);
      expect(analytics.openRate).toBeUndefined();
      expect(analytics.replyRate).toBeUndefined();
    });
  });

  describe("addLeads", () => {
    it("sends prospects in correct format", async () => {
      mockFetch.mockReturnValue(okFetchResponse({ added: 2, duplicates: 0 }));

      const result = await esp.addLeads("42", [
        { email: "a@a.com", firstName: "Alice", lastName: "A", company: "Acme" },
        { email: "b@b.com", firstName: "Bob" },
      ]);

      expect(result.added).toBe(2);
      expect(result.skipped).toBe(0);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.prospects).toHaveLength(2);
      expect(body.prospects[0].email).toBe("a@a.com");
    });
  });

  describe("replyToEmail", () => {
    it("returns unsupported error", async () => {
      const result = await esp.replyToEmail({
        emailId: "1",
        campaignId: "42",
        body: "Thanks",
      });
      expect(result.error).toContain("not supported");
    });
  });

  describe("disableVariant", () => {
    it("returns false (unsupported)", async () => {
      expect(await esp.disableVariant("42", 0, 0)).toBe(false);
    });
  });

  describe("getStepAnalytics", () => {
    it("maps step analytics with 1-indexed to 0-indexed", async () => {
      mockFetch.mockReturnValue(okFetchResponse({
        steps: [
          { step_number: 1, sent: 100, opened: 50, replied: 5, bounced: 2 },
          { step_number: 2, sent: 80, opened: 40, replied: 3, bounced: 1 },
        ],
      }));

      const steps = await esp.getStepAnalytics("42");
      expect(steps).toHaveLength(2);
      expect(steps[0].step).toBe(0);
      expect(steps[1].step).toBe(1);
    });

    it("returns empty array when no steps", async () => {
      mockFetch.mockReturnValue(okFetchResponse({}));
      expect(await esp.getStepAnalytics("42")).toEqual([]);
    });
  });
});
