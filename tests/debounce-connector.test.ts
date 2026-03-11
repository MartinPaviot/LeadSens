import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  testDeBounceConnection,
  getDeBounceCredits,
  validateEmail,
  validateEmailBatch,
  createDeBounceVerifier,
} from "@/server/lib/connectors/debounce";

// Mock sleep to avoid real delays in tests
vi.mock("@/server/lib/connectors/fetch-retry", () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
  BATCH_VERIFY_DELAY_MS: 0,
}));

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

// ─── testDeBounceConnection ─────────────────────────────

describe("testDeBounceConnection", () => {
  it("returns true when API responds with success", async () => {
    mockFetch.mockReturnValue(okResponse({
      debounce: { email: "test@example.com", code: "5", result: "Safe to Send" },
      success: "1",
    }));

    expect(await testDeBounceConnection("valid-key")).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toContain("api=valid-key");
  });

  it("returns false when success is 0", async () => {
    mockFetch.mockReturnValue(okResponse({
      debounce: { email: "test@example.com", code: "0" },
      success: "0",
    }));
    expect(await testDeBounceConnection("bad-key")).toBe(false);
  });

  it("returns false on HTTP error", async () => {
    mockFetch.mockReturnValue(errorResponse(403));
    expect(await testDeBounceConnection("bad-key")).toBe(false);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    expect(await testDeBounceConnection("any-key")).toBe(false);
  });
});

// ─── getDeBounceCredits ─────────────────────────────────

describe("getDeBounceCredits", () => {
  it("parses numeric balance", async () => {
    mockFetch.mockReturnValue(okResponse({ balance: 5000 }));
    expect(await getDeBounceCredits("key")).toBe(5000);
  });

  it("parses string balance", async () => {
    mockFetch.mockReturnValue(okResponse({ balance: "12345" }));
    expect(await getDeBounceCredits("key")).toBe(12345);
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockReturnValue(errorResponse(500));
    await expect(getDeBounceCredits("key")).rejects.toThrow("returned 500");
  });
});

// ─── validateEmail ──────────────────────────────────────

describe("validateEmail", () => {
  it("maps code 5 (Safe to Send) to valid", async () => {
    mockFetch.mockReturnValue(okResponse({
      debounce: { email: "test@good.com", code: "5", result: "Safe to Send", free_email: "false" },
      success: "1",
    }));

    const result = await validateEmail("key", "test@good.com");
    expect(result.email).toBe("test@good.com");
    expect(result.status).toBe("valid");
    expect(result.freeEmail).toBe(false);
  });

  it("maps code 7 (Invalid) to invalid", async () => {
    mockFetch.mockReturnValue(okResponse({
      debounce: { email: "test@bad.com", code: "7", result: "Invalid" },
      success: "1",
    }));
    const result = await validateEmail("key", "test@bad.com");
    expect(result.status).toBe("invalid");
  });

  it("maps code 6 (Disposable) to disposable", async () => {
    mockFetch.mockReturnValue(okResponse({
      debounce: { email: "test@temp.com", code: "6", result: "Disposable" },
      success: "1",
    }));
    const result = await validateEmail("key", "test@temp.com");
    expect(result.status).toBe("disposable");
  });

  it("maps code 3 (Accept All) to catch_all", async () => {
    mockFetch.mockReturnValue(okResponse({
      debounce: { email: "test@catch.com", code: "3", result: "Accept All" },
      success: "1",
    }));
    const result = await validateEmail("key", "test@catch.com");
    expect(result.status).toBe("catch_all");
  });

  it("maps code 4 (Role Account) to unknown", async () => {
    mockFetch.mockReturnValue(okResponse({
      debounce: { email: "info@company.com", code: "4", result: "Role Account" },
      success: "1",
    }));
    const result = await validateEmail("key", "info@company.com");
    expect(result.status).toBe("unknown");
  });

  it("maps code 8 (Unknown) to unknown", async () => {
    mockFetch.mockReturnValue(okResponse({
      debounce: { email: "test@unknown.com", code: "8", result: "Unknown" },
      success: "1",
    }));
    const result = await validateEmail("key", "test@unknown.com");
    expect(result.status).toBe("unknown");
  });

  it("includes did_you_mean when present", async () => {
    mockFetch.mockReturnValue(okResponse({
      debounce: {
        email: "test@gmial.com",
        code: "7",
        result: "Invalid",
        did_you_mean: "test@gmail.com",
      },
      success: "1",
    }));
    const result = await validateEmail("key", "test@gmial.com");
    expect(result.didYouMean).toBe("test@gmail.com");
  });

  it("includes freeEmail as true when free_email='true'", async () => {
    mockFetch.mockReturnValue(okResponse({
      debounce: { email: "test@gmail.com", code: "5", free_email: "true" },
      success: "1",
    }));
    const result = await validateEmail("key", "test@gmail.com");
    expect(result.freeEmail).toBe(true);
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockReturnValue(errorResponse(429));
    await expect(validateEmail("key", "test@test.com")).rejects.toThrow("returned 429");
  });
});

// ─── validateEmailBatch ─────────────────────────────────

describe("validateEmailBatch", () => {
  it("loops single checks and aggregates counts", async () => {
    mockFetch
      .mockReturnValueOnce(okResponse({
        debounce: { email: "a@a.com", code: "5" }, success: "1",
      }))
      .mockReturnValueOnce(okResponse({
        debounce: { email: "b@b.com", code: "7" }, success: "1",
      }))
      .mockReturnValueOnce(okResponse({
        debounce: { email: "c@c.com", code: "3" }, success: "1",
      }));

    const result = await validateEmailBatch("key", ["a@a.com", "b@b.com", "c@c.com"]);

    expect(result.results).toHaveLength(3);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(1);
    expect(result.unknownCount).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

// ─── Retry on 429 ───────────────────────────────────────

describe("validateEmail retry", () => {
  it("retries on 429 then succeeds", async () => {
    mockFetch
      .mockReturnValueOnce(Promise.resolve({ ok: false, status: 429 }))
      .mockReturnValueOnce(okResponse({
        debounce: { email: "test@test.com", code: "5" }, success: "1",
      }));

    const result = await validateEmail("key", "test@test.com");
    expect(result.status).toBe("valid");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws after max retries on persistent 500", async () => {
    mockFetch.mockReturnValue(Promise.resolve({ ok: false, status: 500 }));
    await expect(validateEmail("key", "test@test.com")).rejects.toThrow();
  });
});

// ─── createDeBounceVerifier ─────────────────────────────

describe("createDeBounceVerifier", () => {
  it("returns EmailVerifier interface", () => {
    const verifier = createDeBounceVerifier("key");
    expect(verifier.name).toBe("debounce");
    expect(typeof verifier.verifySingle).toBe("function");
    expect(typeof verifier.verifyBatch).toBe("function");
    expect(typeof verifier.getCredits).toBe("function");
  });
});
